import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import {
  ATTEMPTS_DATASOURCE,
  IAttemptsDatasource,
} from './attempts.datasource';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { AIGradingService } from './grading/ai-grading.service';

describe('AttemptsService', () => {
  let service: AttemptsService;
  let aiGradingService: AIGradingService;

  const mockDatasource: IAttemptsDatasource = {
    findUserByFirebaseUid: jest.fn(),
    findMockTestById: jest.fn(),
    createAttemptWithCreditDeduction: jest.fn(),
    findAttemptByIdWithTest: jest.fn(),
    findAttemptById: jest.fn(),
    findAttemptByIdWithTestAndQuestions: jest.fn(),
    updateAttemptAnswers: jest.fn(),
    updateAttemptGrades: jest.fn(),
    findAllByUser: jest.fn(),
    createGradingRequestWithCreditTransfer: jest.fn(),
  };

  const mockAIGradingService = {
    gradeWriting: jest.fn(),
    gradeSpeaking: jest.fn(),
  };

  const mockStorageProvider = {
    getPresignedUrl: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: ATTEMPTS_DATASOURCE, useValue: mockDatasource },
        { provide: AIGradingService, useValue: mockAIGradingService },
        { provide: 'IStorageProvider', useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<AttemptsService>(AttemptsService);
    aiGradingService = module.get<AIGradingService>(AIGradingService);
  });

  describe('Initialization', () => {
    it('should have EXAM_CREDIT_COST set to 10', () => {
      expect((service as any).EXAM_CREDIT_COST).toBe(10);
    });
  });

  describe('findAllForUser', () => {
    it('should throw NotFoundException if user not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.findAllForUser('uid1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return all attempts for user', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      const mockAttempts = [{ id: 'a1', userId: 'u1' }];
      (mockDatasource.findAllByUser as jest.Mock).mockResolvedValue(
        mockAttempts,
      );

      const result = await service.findAllForUser('uid1');
      expect(result).toEqual(mockAttempts);
      expect(mockDatasource.findAllByUser).toHaveBeenCalledWith('u1');
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
      (
        mockDatasource.createAttemptWithCreditDeduction as jest.Mock
      ).mockRejectedValue(new Error('User not found in transaction'));

      await expect(service.create('uid1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient credits', async () => {
      (mockDatasource.findMockTestById as jest.Mock).mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      (
        mockDatasource.createAttemptWithCreditDeduction as jest.Mock
      ).mockRejectedValue(new Error('INSUFFICIENT_CREDITS:10:5'));

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
      (
        mockDatasource.createAttemptWithCreditDeduction as jest.Mock
      ).mockResolvedValue(mockAttempt);

      const result = await service.create('uid1', 't1');
      expect(result).toEqual(mockAttempt);
      expect(
        mockDatasource.createAttemptWithCreditDeduction,
      ).toHaveBeenCalledWith('uid1', 't1', 'Test', 10);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if user not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if attempt not found', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if attempt belongs to another user', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u2',
      });
      await expect(service.findById('uid1', 'a1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return attempt with test data', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      const mockAttempt = { id: 'a1', userId: 'u1', test: { sections: [] } };
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(
        mockAttempt,
      );

      const result = await service.findById('uid1', 'a1');
      expect(result).toEqual(mockAttempt);
    });

    it('should generate presigned URL if masterAudioPath exists', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        masterAudioPath: 'path/to/audio.mp3',
        test: { sections: [] },
      };
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(
        mockAttempt,
      );
      (mockStorageProvider.getPresignedUrl as jest.Mock).mockResolvedValue(
        'https://presigned-url.com',
      );

      const result = await service.findById('uid1', 'a1');
      expect(result.masterAudioUrl).toBe('https://presigned-url.com');
      expect(mockStorageProvider.getPresignedUrl).toHaveBeenCalledWith(
        'path/to/audio.mp3',
      );
    });

    it('should hide answers if attempt is IN_PROGRESS', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        test: {
          sections: [
            {
              questions: [{ id: 'q1', answerKey: 'SECRET' }],
            },
          ],
        },
      };
      (mockDatasource.findAttemptByIdWithTest as jest.Mock).mockResolvedValue(
        mockAttempt,
      );

      const result = await service.findById('uid1', 'a1');
      expect(
        (result.test.sections[0].questions[0] as any).answerKey,
      ).toBeUndefined();
    });
  });

  describe('updateAnswers', () => {
    it('should throw BadRequestException if attempt is already completed', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
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
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (mockDatasource.findAttemptById as jest.Mock).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
      });
      const updatedAttempt = { id: 'a1', answers: { q1: 'A' } };
      (mockDatasource.updateAttemptAnswers as jest.Mock).mockResolvedValue(
        updatedAttempt,
      );

      const result = await service.updateAnswers('uid1', 'a1', { q1: 'A' });
      expect(result).toEqual(updatedAttempt);
    });
  });

  describe('submit', () => {
    it('should mark attempt as COMPLETED', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (
        mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock
      ).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: {},
        test: { sections: [] },
      });
      const submitted = { id: 'a1', status: AttemptStatus.COMPLETED };
      (mockDatasource.updateAttemptGrades as jest.Mock).mockResolvedValue(
        submitted,
      );

      const result = await service.submit('uid1', 'a1');
      expect(result.status).toBe(AttemptStatus.COMPLETED);
    });

    it('should call AIGradingService for Writing and Speaking sections', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });

      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: {
          q_writing: 'A very long essay about something interesting...',
          q_speaking: { type: 'speaking_transcript', history: [] },
        },
        test: {
          sections: [
            {
              id: 's_w',
              type: 'WRITING',
              questions: [
                { id: 'q_writing', content: { text: 'Describe a city' } },
              ],
            },
            {
              id: 's_s',
              type: 'SPEAKING',
              questions: [{ id: 'q_speaking' }],
            },
          ],
        },
      };

      (
        mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock
      ).mockResolvedValue(mockAttempt);
      (mockAIGradingService.gradeWriting as jest.Mock).mockResolvedValue({
        overallBand: 7.0,
      });
      (mockAIGradingService.gradeSpeaking as jest.Mock).mockResolvedValue({
        overallBand: 6.5,
      });
      (mockDatasource.updateAttemptGrades as jest.Mock).mockResolvedValue({
        id: 'a1',
        status: 'COMPLETED',
      });

      await service.submit('uid1', 'a1');

      expect(aiGradingService.gradeWriting).toHaveBeenCalledWith(
        'Describe a city',
        expect.any(String),
      );
      expect(aiGradingService.gradeSpeaking).toHaveBeenCalled();
      expect(mockDatasource.updateAttemptGrades).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({
          s_w: expect.objectContaining({ bandScore: 7.0, status: 'COMPLETED' }),
          s_s: expect.objectContaining({ bandScore: 6.5, status: 'COMPLETED' }),
        }),
        expect.any(Number),
        expect.objectContaining({
          q_writing: expect.objectContaining({ overallBand: 7.0 }),
          q_speaking: expect.objectContaining({ overallBand: 6.5 }),
        }),
      );
    });

    it('should calculate weighted average (band score) correctly across all modules', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });

      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: { q1: 'A' }, // 1/1 correct -> Band 9.0 in our simplified lookup for 1 question? No, band 1.0 for s1
        test: {
          sections: [
            {
              id: 's1',
              type: 'READING',
              questions: [{ id: 'q1', answerKey: { value: 'A' } }],
            },
            {
              id: 's2',
              type: 'WRITING',
              questions: [{ id: 'q2', content: { text: 'T2' } }],
            },
          ],
        },
      };

      (
        mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock
      ).mockResolvedValue(mockAttempt);
      (mockAIGradingService.gradeWriting as jest.Mock).mockResolvedValue({
        overallBand: 8.0,
      });
      (mockAttempt.answers as Record<string, any>)['q2'] =
        'The aim of science...';

      await service.submit('uid1', 'a1');

      // Reading score for 1/1 is usually low in real IELTS, but our grading.utils matches:
      // Match: if rawScore <= 0 return 0, else match scale.
      // 1 correct in Reading matches { min: 0, band: 1.0 }
      // Reading band: 1.0, Writing band: 8.0 -> Average: 4.5

      expect(mockDatasource.updateAttemptGrades).toHaveBeenCalledWith(
        'a1',
        expect.anything(),
        4.5, // (1.0 + 8.0) / 2 = 4.5
        expect.anything(),
      );
    });

    it('should throw if attempt already submitted', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (
        mockDatasource.findAttemptByIdWithTestAndQuestions as jest.Mock
      ).mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.COMPLETED,
      });

      await expect(service.submit('uid1', 'a1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('bookTeacherReview', () => {
    it('should create grading request when input is valid', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      const request = { id: 'gr1', status: 'PENDING' };
      (
        mockDatasource.createGradingRequestWithCreditTransfer as jest.Mock
      ).mockResolvedValue(request);

      const result = await service.bookTeacherReview(
        'uid1',
        'a1',
        't1',
        'WRITING',
      );
      expect(result).toEqual(request);
      expect(
        mockDatasource.createGradingRequestWithCreditTransfer,
      ).toHaveBeenCalledWith('uid1', 'a1', 't1', 'WRITING');
    });

    it('should throw BadRequestException when credits are insufficient', async () => {
      (mockDatasource.findUserByFirebaseUid as jest.Mock).mockResolvedValue({
        id: 'u1',
      });
      (
        mockDatasource.createGradingRequestWithCreditTransfer as jest.Mock
      ).mockRejectedValue(new Error('INSUFFICIENT_CREDITS:50:10'));

      await expect(
        service.bookTeacherReview('uid1', 'a1', 't1', 'SPEAKING'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
