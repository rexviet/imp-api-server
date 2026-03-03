import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttemptStatus, TransactionType } from '@prisma/client';

describe('AttemptsService', () => {
  let service: AttemptsService;

  const mockTx = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    transaction: { create: jest.fn() },
    userAttempt: { create: jest.fn() },
  };

  const mockPrismaClient = {
    mockTest: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    userAttempt: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockTx)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: PrismaService, useValue: { client: mockPrismaClient } },
      ],
    }).compile();

    service = module.get<AttemptsService>(AttemptsService);
  });

  describe('Initialization', () => {
    it('should have EXAM_CREDIT_COST set to 10', () => {
      expect((service as any).EXAM_CREDIT_COST).toBe(10);
    });
  });

  describe('create', () => {
    it('should throw NotFoundException if test not found', async () => {
      mockPrismaClient.mockTest.findUnique.mockResolvedValue(null);

      await expect(service.create('uid1', 'bad-test')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaClient.mockTest.findUnique.mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      mockTx.user.findUnique.mockResolvedValue(null);

      await expect(service.create('uid1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient credits', async () => {
      mockPrismaClient.mockTest.findUnique.mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      mockTx.user.findUnique.mockResolvedValue({
        id: 'u1',
        creditBalance: 5,
      });

      await expect(service.create('uid1', 't1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create attempt with atomic credit deduction', async () => {
      mockPrismaClient.mockTest.findUnique.mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      mockTx.user.findUnique.mockResolvedValue({
        id: 'u1',
        creditBalance: 100,
      });

      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        testId: 't1',
        status: AttemptStatus.IN_PROGRESS,
      };
      mockTx.userAttempt.create.mockResolvedValue(mockAttempt);

      const result = await service.create('uid1', 't1');

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { creditBalance: { decrement: 10 } },
        }),
      );
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.SPEND,
            amount: -10,
          }),
        }),
      );
      expect(result).toEqual(mockAttempt);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if attempt not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue(null);
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if attempt belongs to another user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue({
        id: 'a1',
        userId: 'u2',
      });
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return attempt with test data', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      const mockAttempt = { id: 'a1', userId: 'u1', test: { sections: [] } };
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue(mockAttempt);

      const result = await service.findById('uid1', 'a1');
      expect(result).toEqual(mockAttempt);
    });
  });

  describe('updateAnswers', () => {
    it('should throw BadRequestException if attempt is already completed', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.COMPLETED,
      });

      await expect(service.updateAnswers('uid1', 'a1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update answers for in-progress attempt', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
      });
      const updatedAttempt = { id: 'a1', answers: { q1: 'A' } };
      mockPrismaClient.userAttempt.update.mockResolvedValue(updatedAttempt);

      const result = await service.updateAnswers('uid1', 'a1', { q1: 'A' });
      expect(result).toEqual(updatedAttempt);
    });
  });

  describe('submit', () => {
    it('should mark attempt as COMPLETED', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        test: { sections: [] },
      });
      const submitted = { id: 'a1', status: AttemptStatus.COMPLETED };
      mockPrismaClient.userAttempt.update.mockResolvedValue(submitted);

      const result = await service.submit('uid1', 'a1');
      expect(result.status).toBe(AttemptStatus.COMPLETED);
    });

    it('should calculate band scores and store in aiGrades on submission', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      
      const mockAttemptWithTest = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: { 'q1': 'A', 'q2': 'listening answer' },
        test: {
          sections: [
            {
              id: 's1',
              type: 'READING',
              questions: [
                { id: 'q1', answerKey: { value: 'A' } }
              ]
            },
            {
              id: 's2',
              type: 'LISTENING',
              questions: [
                { id: 'q2', answerKey: { values: ['listening answer', 'alternative'] } }
              ]
            }
          ]
        }
      };
      
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue(mockAttemptWithTest);
      mockPrismaClient.userAttempt.update.mockResolvedValue({ id: 'a1', status: AttemptStatus.COMPLETED });

      await service.submit('uid1', 'a1');

      expect(mockPrismaClient.userAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AttemptStatus.COMPLETED,
            score: expect.any(Number),
            aiGrades: expect.objectContaining({
              's1': expect.objectContaining({ rawScore: 1, bandScore: expect.any(Number) }),
              's2': expect.objectContaining({ rawScore: 1, bandScore: expect.any(Number) })
            })
          })
        })
      );
    });

    it('should throw if attempt already submitted', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaClient.userAttempt.findUnique.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.COMPLETED,
      });

      await expect(service.submit('uid1', 'a1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
