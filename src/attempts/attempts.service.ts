import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus, TransactionType } from '@prisma/client';

const EXAM_CREDIT_COST = 10; // Credits required to start a mock test

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(firebaseUid: string, testId: string) {
    // Verify mock test exists
    const test = await this.prisma.client.mockTest.findUnique({
      where: { id: testId },
    });
    if (!test) {
      throw new NotFoundException(`Mock test "${testId}" not found`);
    }

    // Verify user exists and has enough credits
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.creditBalance < EXAM_CREDIT_COST) {
      throw new BadRequestException(
        `Insufficient credits. You need ${EXAM_CREDIT_COST} credits but have ${user.creditBalance}.`,
      );
    }

    // Atomically: deduct credits, create ledger entry, and create attempt
    return this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { decrement: EXAM_CREDIT_COST } },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          amount: -EXAM_CREDIT_COST,
          type: TransactionType.SPEND,
          description: `Mock Test: ${test.title}`,
        },
      });

      const attempt = await tx.userAttempt.create({
        data: {
          userId: user.id,
          testId: test.id,
          status: AttemptStatus.IN_PROGRESS,
        },
      });

      return attempt;
    });
  }

  async findById(firebaseUid: string, attemptId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) throw new NotFoundException('User not found');

    const attempt = await this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    order: true,
                    content: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt "${attemptId}" not found`);
    }
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    return attempt;
  }

  async updateAnswers(
    firebaseUid: string,
    attemptId: string,
    answers: Record<string, any>,
  ) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) throw new NotFoundException('User not found');

    const attempt = await this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot update a completed attempt');
    }

    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: { answers },
    });
  }

  async submit(firebaseUid: string, attemptId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) throw new NotFoundException('User not found');

    const attempt = await this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: { status: AttemptStatus.COMPLETED },
    });
  }
}
