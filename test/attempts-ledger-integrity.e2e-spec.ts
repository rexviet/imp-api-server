import { AttemptStatus, GradingStatus, TransactionType } from '@prisma/client';
import { PrismaAttemptsDatasource } from '../src/attempts/attempts.datasource';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedContext = {
  student: {
    id: string;
    firebaseUid: string;
    creditBalance: number;
  };
  teacher: {
    id: string;
    creditBalance: number;
  };
  teacherProfile: {
    id: string;
    creditRate: number;
  };
  test: {
    id: string;
  };
  attempt: {
    id: string;
  };
};

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase(
  'PrismaAttemptsDatasource - Ledger transaction integrity (e2e)',
  () => {
    let prismaService: PrismaService;
    let datasource: PrismaAttemptsDatasource;
    let seedContext: SeedContext;

    const cleanup = async (context: SeedContext | null) => {
      if (!context) return;

      await prismaService.client.gradingRequest.deleteMany({
        where: {
          OR: [
            { attemptId: context.attempt.id },
            { teacherId: context.teacherProfile.id },
          ],
        },
      });

      await prismaService.client.transaction.deleteMany({
        where: {
          userId: {
            in: [context.student.id, context.teacher.id],
          },
        },
      });

      await prismaService.client.userAttempt.deleteMany({
        where: { id: context.attempt.id },
      });

      await prismaService.client.teacherProfile.deleteMany({
        where: { id: context.teacherProfile.id },
      });

      await prismaService.client.mockTest.deleteMany({
        where: { id: context.test.id },
      });

      await prismaService.client.user.deleteMany({
        where: {
          id: {
            in: [context.student.id, context.teacher.id],
          },
        },
      });
    };

    const seed = async (): Promise<SeedContext> => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const student = await prismaService.client.user.create({
        data: {
          firebaseUid: `ledger_student_${suffix}`,
          email: `ledger.student.${suffix}@example.com`,
          name: 'Ledger Student',
          creditBalance: 80,
        },
      });

      const teacher = await prismaService.client.user.create({
        data: {
          firebaseUid: `ledger_teacher_${suffix}`,
          email: `ledger.teacher.${suffix}@example.com`,
          name: 'Ledger Teacher',
          role: 'TEACHER',
          creditBalance: 12,
        },
      });

      const teacherProfile = await prismaService.client.teacherProfile.create({
        data: {
          userId: teacher.id,
          creditRate: 15,
        },
      });

      const test = await prismaService.client.mockTest.create({
        data: {
          id: `test_${suffix}`,
          title: 'Task 3.4a Mock Test',
        },
      });

      const attempt = await prismaService.client.userAttempt.create({
        data: {
          id: `attempt_${suffix}`,
          userId: student.id,
          testId: test.id,
          status: AttemptStatus.COMPLETED,
        },
      });

      return {
        student: {
          id: student.id,
          firebaseUid: student.firebaseUid,
          creditBalance: student.creditBalance,
        },
        teacher: {
          id: teacher.id,
          creditBalance: teacher.creditBalance,
        },
        teacherProfile: {
          id: teacherProfile.id,
          creditRate: teacherProfile.creditRate,
        },
        test: {
          id: test.id,
        },
        attempt: {
          id: attempt.id,
        },
      };
    };

    beforeAll(async () => {
      prismaService = new PrismaService();
      await prismaService.onModuleInit();
      datasource = new PrismaAttemptsDatasource(prismaService);
    });

    beforeEach(async () => {
      seedContext = await seed();
    });

    afterEach(async () => {
      await cleanup(seedContext);
    });

    afterAll(async () => {
      await prismaService.onModuleDestroy();
    });

    it('should atomically transfer credits and create matching ledger records when booking succeeds', async () => {
      const result = await datasource.createGradingRequestWithCreditTransfer(
        seedContext.student.firebaseUid,
        seedContext.attempt.id,
        seedContext.teacherProfile.id,
        'WRITING',
      );

      expect(result.attemptId).toBe(seedContext.attempt.id);
      expect(result.teacherId).toBe(seedContext.teacherProfile.id);
      expect(result.status).toBe(GradingStatus.PENDING);
      expect(result.targetSectionType).toBe('WRITING');

      const [studentAfter, teacherAfter, transactions, gradingRequests] =
        await Promise.all([
          prismaService.client.user.findUnique({
            where: { id: seedContext.student.id },
            select: { creditBalance: true },
          }),
          prismaService.client.user.findUnique({
            where: { id: seedContext.teacher.id },
            select: { creditBalance: true },
          }),
          prismaService.client.transaction.findMany({
            where: {
              userId: {
                in: [seedContext.student.id, seedContext.teacher.id],
              },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              userId: true,
              amount: true,
              type: true,
            },
          }),
          prismaService.client.gradingRequest.findMany({
            where: {
              attemptId: seedContext.attempt.id,
              teacherId: seedContext.teacherProfile.id,
            },
          }),
        ]);

      expect(studentAfter?.creditBalance).toBe(
        seedContext.student.creditBalance -
          seedContext.teacherProfile.creditRate,
      );
      expect(teacherAfter?.creditBalance).toBe(
        seedContext.teacher.creditBalance +
          seedContext.teacherProfile.creditRate,
      );

      expect(transactions).toHaveLength(2);
      expect(transactions).toEqual(
        expect.arrayContaining([
          {
            userId: seedContext.student.id,
            amount: -seedContext.teacherProfile.creditRate,
            type: TransactionType.SPEND,
          },
          {
            userId: seedContext.teacher.id,
            amount: seedContext.teacherProfile.creditRate,
            type: TransactionType.EARN,
          },
        ]),
      );

      expect(gradingRequests).toHaveLength(1);
    });

    it('should rollback debit/credit and ledger writes when grading request creation fails late in transaction', async () => {
      await expect(
        datasource.createGradingRequestWithCreditTransfer(
          seedContext.student.firebaseUid,
          seedContext.attempt.id,
          seedContext.teacherProfile.id,
          'INVALID_SECTION' as unknown as 'WRITING',
        ),
      ).rejects.toThrow();

      const [studentAfter, teacherAfter, transactions, gradingRequests] =
        await Promise.all([
          prismaService.client.user.findUnique({
            where: { id: seedContext.student.id },
            select: { creditBalance: true },
          }),
          prismaService.client.user.findUnique({
            where: { id: seedContext.teacher.id },
            select: { creditBalance: true },
          }),
          prismaService.client.transaction.findMany({
            where: {
              userId: {
                in: [seedContext.student.id, seedContext.teacher.id],
              },
            },
          }),
          prismaService.client.gradingRequest.findMany({
            where: {
              attemptId: seedContext.attempt.id,
              teacherId: seedContext.teacherProfile.id,
            },
          }),
        ]);

      expect(studentAfter?.creditBalance).toBe(
        seedContext.student.creditBalance,
      );
      expect(teacherAfter?.creditBalance).toBe(
        seedContext.teacher.creditBalance,
      );
      expect(transactions).toHaveLength(0);
      expect(gradingRequests).toHaveLength(0);
    });
  },
);
