import { Test, TestingModule } from '@nestjs/testing';
import { SpeakingSessionService } from './speaking-session.service';
import { AIService } from '../ai/ai.service';
import { SttService } from './stt.service';
import { IStorageProvider } from '../common/interfaces/storage-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessage } from '../ai/ai-engine.interface';

describe('SpeakingSessionService', () => {
  let service: SpeakingSessionService;
  let mockAiService: AIService;
  let mockSttService: SttService;

  beforeEach(async () => {
    mockAiService = {
      generateResponse: jest.fn().mockResolvedValue('AI Response'),
    } as any;

    mockSttService = {
      transcribeAudio: jest.fn().mockResolvedValue('User Transcript'),
    } as any;

    const mockStorageProvider = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue('http://upload-url'),
      getPresignedUrl: jest.fn().mockResolvedValue('http://download-url'),
    };

    const mockPrismaService = {
      client: {
        userAttempt: {
          update: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn().mockResolvedValue({
            masterAudioBucket: 'test-bucket',
            masterAudioPath: 'test-path',
          }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeakingSessionService,
        { provide: AIService, useValue: mockAiService },
        { provide: SttService, useValue: mockSttService },
        { provide: 'IStorageProvider', useValue: mockStorageProvider },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SpeakingSessionService>(SpeakingSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initializeSession', () => {
    it('creates history and delegates seeding to ai service', async () => {
      const attemptId = 'init_1';
      const result = await service.initializeSession(
        attemptId,
        'q1',
        'Part 1 intro',
      );

      expect(result).toBe('AI Response');
      // AI called with memory mapping
      expect(mockAiService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }), // The seed
        ]),
      );
    });
  });

  describe('createUploadUrl', () => {
    it('generates a presigned URL and updates db', async () => {
      const url = await service.createUploadUrl('u-1');
      expect(url).toBe('http://upload-url');
    });
  });

  describe('getDownloadUrl', () => {
    it('retrieves path from db and returns provider url', async () => {
      const url = await service.getDownloadUrl('d-1');
      expect(url).toBe('http://download-url');
    });
  });

  describe('processTurn', () => {
    it('throws error if session not initialized', async () => {
      await expect(service.processTurn('invalid_id', 'audio')).rejects.toThrow(
        'Session not initialized',
      );
    });

    it('processes user audio turn and appends model response', async () => {
      const attemptId = 'attempt_123';
      await service.initializeSession(attemptId, 'q1'); // Seed history

      const { transcript, nextQuestion } = await service.processTurn(
        attemptId,
        'base64',
      );

      expect(transcript).toBe('User Transcript');
      expect(nextQuestion).toBe('AI Response');

      // AI should have 4 history messages now: system, user(seed), model(seed), user(new audio)
      expect(mockAiService.generateResponse).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          expect.objectContaining({ role: 'model', content: 'AI Response' }),
          expect.objectContaining({ role: 'user', content: 'User Transcript' }),
        ]),
      );
    });

    it('throws error if STT fails to transcribe', async () => {
      const attemptId = 'attempt_clean';
      await service.initializeSession(attemptId, 'q1');

      // Mutate STT response
      jest.spyOn(mockSttService, 'transcribeAudio').mockResolvedValueOnce('');

      await expect(service.processTurn(attemptId, 'base64')).rejects.toThrow(
        'Could not transcribe audio',
      );
    });
  });

  describe('endSession', () => {
    it('deletes history mapping', async () => {
      const attemptId = 'kill_me';
      await service.initializeSession(attemptId, 'q1');

      await service.endSession(attemptId);
      await expect(service.processTurn(attemptId, 'base64')).rejects.toThrow(
        'Session not initialized',
      );
    });
  });
});
