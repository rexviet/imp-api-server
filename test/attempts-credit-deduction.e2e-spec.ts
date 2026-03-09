import { AttemptStatus, TransactionType } from '@prisma/client';
import { PrismaAttemptsDatasource } from '../src/attempts/attempts.datasource';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedContext = {
  user: {
    id: string;
    firebaseUid: string;
    creditBalance: number;
  };
  test: {
    id: string;
    title: string;
  };
};

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase(
  'PrismaAttemptsDatasource - Attempt credit deduction integrity (e2e)',
  () => {
    let prismaService: PrismaService;
    let datasource: PrismaAttemptsDatasource;
    let seedContext: SeedContext;

    const cleanup = async (context: SeedContext | null) => {
      if (!context) return;

      await prismaService.client.transaction.deleteMany({
        where: { userId: context.user.id },
      });

      await prismaService.client.userAttempt.deleteMany({
        where: {
          userId: context.user.id,
          testId: context.test.id,
        },
      });

      await prismaService.client.mockTest.deleteMany({
        where: { id: context.test.id },
      });

      await prismaService.client.user.deleteMany({
        where: { id: context.user.id },
      });
    };

    const seed = async (creditBalance = 25): Promise<SeedContext> => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const user = await prismaService.client.user.create({
        data: {
          firebaseUid: `attempt_credit_student_${suffix}`,
          email: `attempt.credit.${suffix}@example.com`,
          name: 'Attempt Credit Student',
          creditBalance,
        },
      });

      const test = await prismaService.client.mockTest.create({
        data: {
          id: `attempt_credit_test_${suffix}`,
          title: 'Task 1.2 Atomic Credit Deduction',
        },
      });

      return {
        user: {
          id: user.id,
          firebaseUid: user.firebaseUid,
          creditBalance: user.creditBalance,
        },
        test: {
          id: test.id,
          title: test.title,
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

    it('should atomically deduct credits, create a spend ledger entry, and persist the attempt on success', async () => {
      const creditCost = 10;

      const result = await datasource.createAttemptWithCreditDeduction(
        seedContext.user.firebaseUid,
        seedContext.test.id,
        seedContext.test.title,
        creditCost,
      );

      expect(result.userId).toBe(seedContext.user.id);
      expect(result.testId).toBe(seedContext.test.id);
      expect(result.status).toBe(AttemptStatus.IN_PROGRESS);

      const [userAfter, transactions, attempts] = await Promise.all([
        prismaService.client.user.findUnique({
          where: { id: seedContext.user.id },
          select: { creditBalance: true },
        }),
        prismaService.client.transaction.findMany({
          where: { userId: seedContext.user.id },
          orderBy: { createdAt: 'asc' },
          select: {
            amount: true,
            type: true,
            description: true,
          },
        }),
        prismaService.client.userAttempt.findMany({
          where: {
            userId: seedContext.user.id,
            testId: seedContext.test.id,
          },
          select: {
            id: true,
            status: true,
          },
        }),
      ]);

      expect(userAfter?.creditBalance).toBe(
        seedContext.user.creditBalance - creditCost,
      );
      expect(transactions).toEqual([
        {
          amount: -creditCost,
          type: TransactionType.SPEND,
          description: `Mock Test: ${seedContext.test.title}`,
        },
      ]);
      expect(attempts).toEqual([
        {
          id: result.id,
          status: AttemptStatus.IN_PROGRESS,
        },
      ]);
    });

    it('should prevent overspend and duplicate spend ledger writes under concurrent attempt creation burst', async () => {
      const creditCost = 10;
      const burstSize = 12;

      await prismaService.client.user.update({
        where: { id: seedContext.user.id },
        data: { creditBalance: creditCost },
      });

      const settled = await Promise.allSettled(
        Array.from({ length: burstSize }).map(() =>
          datasource.createAttemptWithCreditDeduction(
            seedContext.user.firebaseUid,
            seedContext.test.id,
            seedContext.test.title,
            creditCost,
          ),
        ),
      );

      const fulfilledCount = settled.filter(
        (result) => result.status === 'fulfilled',
      ).length;
      const rejected = settled.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      expect(fulfilledCount).toBe(1);
      expect(rejected).toHaveLength(burstSize - 1);
      rejected.forEach((result) => {
        expect(result.reason).toBeInstanceOf(Error);
        expect(result.reason.message).toBe(
          `INSUFFICIENT_CREDITS:${creditCost}:0`,
        );
      });

      const [userAfter, transactions, attempts] = await Promise.all([
        prismaService.client.user.findUnique({
          where: { id: seedContext.user.id },
          select: { creditBalance: true },
        }),
        prismaService.client.transaction.findMany({
          where: { userId: seedContext.user.id },
          select: {
            amount: true,
            type: true,
            description: true,
          },
        }),
        prismaService.client.userAttempt.findMany({
          where: {
            userId: seedContext.user.id,
            testId: seedContext.test.id,
          },
          select: {
            status: true,
          },
        }),
      ]);

      expect(userAfter?.creditBalance).toBe(0);
      expect(transactions).toEqual([
        {
          amount: -creditCost,
          type: TransactionType.SPEND,
          description: `Mock Test: ${seedContext.test.title}`,
        },
      ]);
      expect(attempts).toEqual([
        {
          status: AttemptStatus.IN_PROGRESS,
        },
      ]);
    }, 15000);
  },
);
