import { Test, TestingModule } from '@nestjs/testing';
import { CreditsService } from './credits.service';
import { CREDITS_DATASOURCE, ICreditsDatasource } from './credits.datasource';
import { NotFoundException } from '@nestjs/common';

describe('CreditsService', () => {
  let service: CreditsService;

  const mockDatasource: ICreditsDatasource = {
    findUserByFirebaseUid: jest.fn(),
    topUpCreditsTransaction: jest.fn(),
    findTransactionsByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: CREDITS_DATASOURCE, useValue: mockDatasource },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  describe('topUpCredits', () => {
    it('should throw NotFoundException if user not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.topUpCredits('uid1', 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call datasource topUpCreditsTransaction with correct params', async () => {
      const mockUser = {
        id: 'my_user_id',
        firebaseUid: 'uid1',
        creditBalance: 100,
      };
      const mockResult = {
        user: { ...mockUser, creditBalance: 200 },
        transaction: { id: 'tx_id', amount: 100, type: 'TOPUP' },
      };

      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (mockDatasource.topUpCreditsTransaction as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const result = await service.topUpCredits('uid1', 100);

      expect(result).toEqual(mockResult);
      expect(mockDatasource.topUpCreditsTransaction).toHaveBeenCalledWith(
        'my_user_id',
        100,
        'Mock Top-up: 100 credits',
      );
    });
  });

  describe('getTransactions', () => {
    it('should throw NotFoundException if user not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.getTransactions('uid2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return transactions from datasource', async () => {
      const mockUser = { id: 'my_user_id' };
      const mockTransactions = [{ id: 'tx1' }, { id: 'tx2' }];

      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (mockDatasource.findTransactionsByUserId as jest.Mock).mockResolvedValue(
        mockTransactions,
      );

      const result = await service.getTransactions('uid2');

      expect(result).toEqual(mockTransactions);
      expect(mockDatasource.findTransactionsByUserId).toHaveBeenCalledWith(
        'my_user_id',
        50,
      );
    });
  });
});
