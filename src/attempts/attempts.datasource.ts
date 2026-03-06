import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttemptStatus,
  GradingStatus,
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
  findAllByUser(userId: string): Promise<any[]>;
  createGradingRequestWithCreditTransfer(
    firebaseUid: string,
    attemptId: string,
    teacherProfileId: string,
  ): Promise<any>;
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
        gradingRequests: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
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
                    answerKey: true,
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

  async findAllByUser(userId: string): Promise<any[]> {
    return this.prisma.client.userAttempt.findMany({
      where: { userId },
      include: {
        test: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGradingRequestWithCreditTransfer(
    firebaseUid: string,
    attemptId: string,
    teacherProfileId: string,
  ): Promise<any> {
    return this.prisma.client.$transaction(async (tx) => {
      const student = await tx.user.findUnique({
        where: { firebaseUid },
      });
      if (!student) throw new Error('User not found in transaction');

      const attempt = await tx.userAttempt.findFirst({
        where: { id: attemptId, userId: student.id },
        include: { test: { select: { title: true } } },
      });
      if (!attempt) throw new Error('ATTEMPT_NOT_FOUND_OR_FORBIDDEN');
      if (attempt.status === AttemptStatus.IN_PROGRESS) {
        throw new Error('ATTEMPT_NOT_COMPLETED');
      }

      const teacherProfile = await tx.teacherProfile.findUnique({
        where: { id: teacherProfileId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      if (!teacherProfile) throw new Error('TEACHER_NOT_FOUND');

      const existingPendingRequest = await tx.gradingRequest.findFirst({
        where: {
          attemptId,
          teacherId: teacherProfileId,
          status: GradingStatus.PENDING,
        },
      });
      if (existingPendingRequest) throw new Error('GRADING_REQUEST_EXISTS');

      const cost = teacherProfile.creditRate;
      if (student.creditBalance < cost) {
        throw new Error(
          `INSUFFICIENT_CREDITS:${cost}:${student.creditBalance}`,
        );
      }

      await tx.user.update({
        where: { id: student.id },
        data: { creditBalance: { decrement: cost } },
      });
      await tx.transaction.create({
        data: {
          userId: student.id,
          amount: -cost,
          type: TransactionType.SPEND,
          description: `Teacher review booking for "${attempt.test.title}"`,
        },
      });

      await tx.user.update({
        where: { id: teacherProfile.user.id },
        data: { creditBalance: { increment: cost } },
      });
      await tx.transaction.create({
        data: {
          userId: teacherProfile.user.id,
          amount: cost,
          type: TransactionType.EARN,
          description: `Review booking income for "${attempt.test.title}"`,
        },
      });

      return tx.gradingRequest.create({
        data: {
          attemptId,
          teacherId: teacherProfileId,
          status: GradingStatus.PENDING,
        },
        include: {
          teacher: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });
  }
}
