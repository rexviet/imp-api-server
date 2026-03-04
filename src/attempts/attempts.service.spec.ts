import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import { ATTEMPTS_DATASOURCE, IAttemptsDatasource } from './attempts.datasource';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';

describe('AttemptsService', () => {
  let service: AttemptsService;

  const mockDatasource: IAttemptsDatasource = {
    findUserByFirebaseUid: jest.fn(),
    findMockTestById: jest.fn(),
    createAttemptWithCreditDeduction: jest.fn(),
    findAttemptByIdWithTest: jest.fn(),
    findAttemptById: jest.fn(),
    findAttemptByIdWithTestAndQuestions: jest.fn(),
    updateAttemptAnswers: jest.fn(),
    updateAttemptGrades: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: ATTEMPTS_DATASOURCE, useValue: mockDatasource },
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
      (mockDatasource.findMockTestById as jest.Mock).mockResolvedValue(null);

      await expect(service.create('uid1', 'bad-test')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if user not found in transaction', async () => {
      (mockDatasource.findMockTestById as jest.Mock).mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      (mockDatasource.createAttemptWithCreditDeduction as jest.Mock).mockRejectedValue(
        new Error('User not found in transaction'),
      );

      await expect(service.create('uid1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient credits', async () => {
      (mockDatasource.findMockTestById as jest.Mock).mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      (mockDatasource.createAttemptWithCreditDeduction as jest.Mock).mockRejectedValue(
        new Error('INSUFFICIENT_CREDITS:10:5'),
      );

      await expect(service.create('uid1', 't1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create attempt via datasource', async () => {
      (mockDatasource.findMockTestById as jest.Mock).mockResolvedValue({
        id: 't1',
        title: 'Test',
      });

      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        testId: 't1',
        status: AttemptStatus.IN_PROGRESS,
      };
      (mockDatasource.createAttemptWithCreditDeduction as jest.Mock).mockResolvedValue(
        mockAttempt,
      );

      const result = await service.create('uid1', 't1');
      expect(result).toEqual(mockAttempt);
      expect(mockDatasource.createAttemptWithCreditDeduction).toHaveBeenCalledWith(
        'uid1', 't1', 'Test', 10,
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(null);
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if attempt not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(null);
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if attempt belongs to another user', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u2',
      });
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return attempt with test data', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      const mockAttempt = { id: 'a1', userId: 'u1', test: { sections: [] } };
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(mockAttempt);

      const result = await service.findById('uid1', 'a1');
      expect(result).toEqual(mockAttempt);
    });
  });

  describe('updateAnswers', () => {
    it('should throw BadRequestException if attempt is already completed', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptById as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.COMPLETED,
      });

      await expect(service.updateAnswers('uid1', 'a1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update answers for in-progress attempt', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptById as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
      });
      const updatedAttempt = { id: 'a1', answers: { q1: 'A' } };
      (mockDatasource.updateAttemptAnswers as jest.Mock).mockResolvedValue(updatedAttempt);

      const result = await service.updateAnswers('uid1', 'a1', { q1: 'A' });
      expect(result).toEqual(updatedAttempt);
    });
  });

  describe('submit', () => {
    it('should mark attempt as COMPLETED', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: {},
        test: { sections: [] },
      });
      const submitted = { id: 'a1', status: AttemptStatus.COMPLETED };
      (mockDatasource.updateAttemptGrades as jest.Mock).mockResolvedValue(submitted);

      const result = await service.submit('uid1', 'a1');
      expect(result.status).toBe(AttemptStatus.COMPLETED);
    });

    it('should calculate band scores and call updateAttemptGrades on submission', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });

      const mockAttemptWithTest = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: { q1: 'A', q2: 'listening answer' },
        test: {
          sections: [
            {
              id: 's1',
              type: 'READING',
              questions: [{ id: 'q1', answerKey: { value: 'A' } }],
            },
            {
              id: 's2',
              type: 'LISTENING',
              questions: [
                {
                  id: 'q2',
                  answerKey: { values: ['listening answer', 'alternative'] },
                },
              ],
            },
          ],
        },
      };

      (mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock).mockResolvedValue(
        mockAttemptWithTest,
      );
      (mockDatasource.updateAttemptGrades as jest.Mock).mockResolvedValue({
        id: 'a1',
        status: AttemptStatus.COMPLETED,
      });

      await service.submit('uid1', 'a1');

      expect(mockDatasource.updateAttemptGrades).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({
          s1: expect.objectContaining({ rawScore: 1, bandScore: expect.any(Number) }),
          s2: expect.objectContaining({ rawScore: 1, bandScore: expect.any(Number) }),
        }),
        expect.any(Number),
      );
    });

    it('should throw if attempt already submitted', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock).mockResolvedValue({
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
