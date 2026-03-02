import { Test, TestingModule } from '@nestjs/testing';
import { CreditsService } from './credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

describe('CreditsService', () => {
  let service: CreditsService;
  let prismaService: PrismaService;

  const mockTx = {
    user: { update: jest.fn() },
    transaction: { create: jest.fn() },
  };

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        {
          provide: PrismaService,
          useValue: { client: mockPrismaClient },
        },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('topUpCredits', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      await expect(service.topUpCredits('uid1', 100)).rejects.toThrow(NotFoundException);
    });

    it('should correctly run a transaction to update user credits and create transaction history', async () => {
      const mockUser = { id: 'my_user_id', firebaseUid: 'uid1', creditBalance: 100 };
      const updatedUser = { ...mockUser, creditBalance: 200 };
      const createdTx = { id: 'tx_id', amount: 100, type: TransactionType.TOPUP };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockTx.user.update.mockResolvedValue(updatedUser);
      mockTx.transaction.create.mockResolvedValue(createdTx);

      const result = await service.topUpCredits('uid1', 100);

      expect(result).toEqual({ user: updatedUser, transaction: createdTx });
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'my_user_id' },
        data: { creditBalance: { increment: 100 } },
      });
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'my_user_id',
          amount: 100,
          type: TransactionType.TOPUP,
          description: 'Mock Top-up: 100 credits',
        },
      });
    });
  });

  describe('getTransactions', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      await expect(service.getTransactions('uid2')).rejects.toThrow(NotFoundException);
    });

    it('should return 50 latest transactions', async () => {
      const mockUser = { id: 'my_user_id' };
      const mockTransactions = [{ id: 'tx1' }, { id: 'tx2' }];

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getTransactions('uid2');

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'my_user_id' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });
});
