import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptStatus, TransactionType } from '@prisma/client';
import { calculateBandScore, roundToIELTS } from './grading.utils';

const EXAM_CREDIT_COST = 10; // Credits required to start a mock test

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUser(firebaseUid: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(firebaseUid: string, testId: string) {
    // 1. Verify mock test exists (READ only, can be outside)
    const test = await this.prisma.client.mockTest.findUnique({
      where: { id: testId },
    });
    if (!test) {
      throw new NotFoundException(`Mock test "${testId}" not found`);
    }

    // 2. Start ATOMIC transaction for money-sensitive ops
    return this.prisma.client.$transaction(async (tx) => {
      // Re-fetch user INSIDE transaction to lock or ensure consistency
      const user = await tx.user.findUnique({
        where: { firebaseUid },
      });
      if (!user) throw new NotFoundException('User not found');

      // 3. Strict balance check INSIDE transaction
      if (user.creditBalance < EXAM_CREDIT_COST) {
        throw new BadRequestException(
          `Insufficient credits. You need ${EXAM_CREDIT_COST} credits but have ${user.creditBalance}.`,
        );
      }

      // 4. Deduct & Create ledger
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

      return tx.userAttempt.create({
        data: {
          userId: user.id,
          testId: test.id,
          status: AttemptStatus.IN_PROGRESS,
        },
      });
    });
  }

  async findById(firebaseUid: string, attemptId: string) {
    const user = await this.resolveUser(firebaseUid);

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
    answers: Record<string, unknown>,
  ) {
    const user = await this.resolveUser(firebaseUid);

    const attempt = await this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt)
      throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot update a completed attempt');
    }

    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: { answers: answers as any },
    });
  }

  async submit(firebaseUid: string, attemptId: string) {
    const user = await this.resolveUser(firebaseUid);

    const attempt = await this.prisma.client.userAttempt.findUnique({
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

    if (!attempt) throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const answers = (attempt.answers as Record<string, string>) || {};
    const results: Record<string, any> = {};
    let bandSums = 0;
    let gradedSectionsCount = 0;

    for (const section of attempt.test.sections) {
      let sectionRawScore = 0;
      const sectionDetails: Record<string, any> = {
        type: section.type,
        questions: [],
      };

      if (section.type === 'LISTENING' || section.type === 'READING') {
        for (const question of section.questions) {
          const userAnswer = (answers[question.id] || '').trim().toLowerCase();
          const answerKey = question.answerKey as any;
          
          let isCorrect = false;
          let correctAnswer = '';

          if (answerKey && typeof answerKey.value === 'string') {
            correctAnswer = answerKey.value;
            isCorrect = userAnswer === correctAnswer.trim().toLowerCase();
          } else if (answerKey && Array.isArray(answerKey.values)) {
            correctAnswer = answerKey.values.join(' / ');
            isCorrect = answerKey.values.some(
              (v: string) => v.trim().toLowerCase() === userAnswer
            );
          }

          if (isCorrect) sectionRawScore++;
          
          sectionDetails.questions.push({
            questionId: question.id,
            isCorrect,
            userAnswer,
            correctAnswer,
          });
        }

        const band = calculateBandScore(sectionRawScore, section.type);
        sectionDetails.rawScore = sectionRawScore;
        sectionDetails.bandScore = band;
        
        bandSums += band;
        gradedSectionsCount++;
      } else {
        sectionDetails.status = 'PENDING_EVALUATION';
      }

      results[section.id] = sectionDetails;
    }

    const overallScore = gradedSectionsCount > 0 
      ? roundToIELTS(bandSums / gradedSectionsCount)
      : null;

    return this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.COMPLETED,
        aiGrades: results as any,
        score: overallScore,
      },
    });
  }
}
