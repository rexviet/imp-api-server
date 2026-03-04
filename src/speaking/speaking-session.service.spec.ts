import { Test, TestingModule } from '@nestjs/testing';
import { SpeakingSessionService } from './speaking-session.service';
import { AIService } from '../ai/ai.service';
import { SttService } from './stt.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeakingSessionService,
        { provide: AIService, useValue: mockAiService },
        { provide: SttService, useValue: mockSttService },
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
      const result = await service.initializeSession(attemptId);
      
      expect(result).toBe('AI Response');
      // AI called with memory mapping
      expect(mockAiService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }), // The seed
        ])
      );
    });
  });

  describe('processTurn', () => {
    it('throws error if session not initialized', async () => {
      await expect(service.processTurn('invalid_id', 'audio')).rejects.toThrow('Session not initialized');
    });

    it('processes user audio turn and appends model response', async () => {
      const attemptId = 'attempt_123';
      await service.initializeSession(attemptId); // Seed history

      const { transcript, nextQuestion } = await service.processTurn(attemptId, 'base64');
      
      expect(transcript).toBe('User Transcript');
      expect(nextQuestion).toBe('AI Response');

      // AI should have 4 history messages now: system, user(seed), model(seed), user(new audio)
      expect(mockAiService.generateResponse).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          expect.objectContaining({ role: 'model', content: 'AI Response' }),
          expect.objectContaining({ role: 'user', content: 'User Transcript' }),
        ])
      );
    });

    it('throws error if STT fails to transcribe', async () => {
      const attemptId = 'attempt_clean';
      await service.initializeSession(attemptId);

      // Mutate STT response
      jest.spyOn(mockSttService, 'transcribeAudio').mockResolvedValueOnce('');

      await expect(service.processTurn(attemptId, 'base64')).rejects.toThrow('Could not transcribe audio');
    });
  });

  describe('endSession', () => {
    it('deletes history mapping', async () => {
      const attemptId = 'kill_me';
      await service.initializeSession(attemptId);
      
      service.endSession(attemptId);
      await expect(service.processTurn(attemptId, 'base64')).rejects.toThrow('Session not initialized');
    });
  });
});
