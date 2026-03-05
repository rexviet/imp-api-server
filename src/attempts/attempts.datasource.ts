import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttemptStatus,
  TransactionType,
  User,
  UserAttempt,
  MockTest,
} from '@prisma/client';

export interface IAttemptsDatasource {
  findUserByFirebaseUid(firebaseUid: string): Promise<User | null>;
  findMockTestById(testId: string): Promise<MockTest | null>;
  createAttemptWithCreditDeduction(
    firebaseUid: string,
    testId: string,
    testTitle: string,
    creditCost: number,
  ): Promise<UserAttempt>;
  findAttemptByIdWithTest(attemptId: string): Promise<any | null>;
  findAttemptById(attemptId: string): Promise<UserAttempt | null>;
  findAttemptByIdWithTestAndQuestions(attemptId: string): Promise<any | null>;
  updateAttemptAnswers(
    attemptId: string,
    answers: Record<string, unknown>,
  ): Promise<UserAttempt>;
  updateAttemptGrades(
    attemptId: string,
    grades: Record<string, any>,
    score: number | null,
    detailedAiFeedback?: Record<string, any>,
  ): Promise<UserAttempt>;
}

export const ATTEMPTS_DATASOURCE = 'ATTEMPTS_DATASOURCE';

@Injectable()
export class PrismaAttemptsDatasource implements IAttemptsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
  }

  async findMockTestById(testId: string): Promise<MockTest | null> {
    return this.prisma.client.mockTest.findUnique({
      where: { id: testId },
    });
  }

  async createAttemptWithCreditDeduction(
    firebaseUid: string,
    testId: string,
    testTitle: string,
    creditCost: number,
  ): Promise<UserAttempt> {
    return this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { firebaseUid },
      });
      if (!user) throw new Error('User not found in transaction');

      if (user.creditBalance < creditCost) {
        throw new Error(
          `INSUFFICIENT_CREDITS:${creditCost}:${user.creditBalance}`,
        );
      }

      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { decrement: creditCost } },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          amount: -creditCost,
          type: TransactionType.SPEND,
          description: `Mock Test: ${testTitle}`,
        },
      });

      return tx.userAttempt.create({
        data: {
          userId: user.id,
          testId,
          status: AttemptStatus.IN_PROGRESS,
        },
      });
    });
  }

  async findAttemptByIdWithTest(attemptId: string): Promise<any | null> {
    return this.prisma.client.userAttempt.findUnique({
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
  }

  async findAttemptById(attemptId: string): Promise<UserAttempt | null> {
    return this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
    });
  }

  async findAttemptByIdWithTestAndQuestions(
    attemptId: string,
  ): Promise<any | null> {
    return this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            sections: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
    });
  }

  async updateAttemptAnswers(
    attemptId: string,
    answers: Record<string, unknown>,
  ): Promise<UserAttempt> {
    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: { answers: answers as any },
    });
  }

  async updateAttemptGrades(
    attemptId: string,
    grades: Record<string, any>,
    score: number | null,
    detailedAiFeedback?: Record<string, any>,
  ): Promise<UserAttempt> {
    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.COMPLETED,
        aiGrades: {
          sections: grades,
          detailed: detailedAiFeedback,
        } as any,
        score,
      },
    });
  }
}
