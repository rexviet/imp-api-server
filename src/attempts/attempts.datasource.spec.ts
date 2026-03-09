import { AttemptStatus, TransactionType } from '@prisma/client';
import { PrismaAttemptsDatasource } from './attempts.datasource';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaAttemptsDatasource', () => {
  const buildDatasource = () => {
    const tx = {
      user: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      userAttempt: {
        create: jest.fn(),
      },
    };

    const prismaService = {
      client: {
        $transaction: jest.fn(
          async (
            callback: (transactionClient: typeof tx) => Promise<unknown>,
          ) => callback(tx),
        ),
      },
    } as unknown as PrismaService;

    return {
      datasource: new PrismaAttemptsDatasource(prismaService),
      prismaService,
      tx,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAttemptWithCreditDeduction', () => {
    it('should guard debit atomically before writing the ledger and attempt', async () => {
      const { datasource, prismaService, tx } = buildDatasource();
      const mockAttempt = {
        id: 'attempt-1',
        userId: 'user-1',
        testId: 'test-1',
        status: AttemptStatus.IN_PROGRESS,
      };

      tx.user.findUnique.mockResolvedValue({ id: 'user-1' });
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.transaction.create.mockResolvedValue({
        id: 'tx-1',
        amount: -10,
        type: TransactionType.SPEND,
      });
      tx.userAttempt.create.mockResolvedValue(mockAttempt);

      const result = await datasource.createAttemptWithCreditDeduction(
        'firebase-uid-1',
        'test-1',
        'Atomic Test',
        10,
      );

      expect(result).toEqual(mockAttempt);
      expect(prismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          creditBalance: { gte: 10 },
        },
        data: { creditBalance: { decrement: 10 } },
      });
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          amount: -10,
          type: TransactionType.SPEND,
          description: 'Mock Test: Atomic Test',
        },
      });
      expect(tx.userAttempt.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          testId: 'test-1',
          status: AttemptStatus.IN_PROGRESS,
        },
      });
    });

    it('should report the latest balance when the atomic debit guard rejects the spend', async () => {
      const { datasource, tx } = buildDatasource();

      tx.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1' })
        .mockResolvedValueOnce({ creditBalance: 3 });
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        datasource.createAttemptWithCreditDeduction(
          'firebase-uid-1',
          'test-1',
          'Atomic Test',
          10,
        ),
      ).rejects.toThrow('INSUFFICIENT_CREDITS:10:3');

      expect(tx.transaction.create).not.toHaveBeenCalled();
      expect(tx.userAttempt.create).not.toHaveBeenCalled();
    });
  });
});
