import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from './ai.service';
import { AI_ENGINE, IAIEngine, ChatMessage } from './ai-engine.interface';

describe('AIService', () => {
  let service: AIService;
  let mockEngine: IAIEngine;

  const mockAIEngine: IAIEngine = {
    generateResponse: jest.fn(),
    generateResponseStream: jest.fn(),
    generateStructuredResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: AI_ENGINE,
          useValue: mockAIEngine,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    mockEngine = module.get<IAIEngine>(AI_ENGINE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateResponse', () => {
    it('delegates to aiEngine', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      (mockEngine.generateResponse as jest.Mock).mockResolvedValue('response');

      const result = await service.generateResponse(messages);
      expect(result).toBe('response');
      expect(mockEngine.generateResponse).toHaveBeenCalledWith(messages);
    });
  });

  describe('generateResponseStream', () => {
    it('delegates to aiEngine', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const mockStream = (async function* () {
        yield 'streamed';
      })();
      (mockEngine.generateResponseStream as jest.Mock).mockReturnValue(
        mockStream,
      );

      const stream = service.generateResponseStream(messages);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['streamed']);
      expect(mockEngine.generateResponseStream).toHaveBeenCalledWith(messages);
    });
  });

  describe('generateStructuredResponse', () => {
    it('delegates to aiEngine with generic types', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'json' }];
      const schema = { type: 'object' };
      (mockEngine.generateStructuredResponse as jest.Mock).mockResolvedValue({
        key: 'val',
      });

      const result = await service.generateStructuredResponse(messages, schema);
      expect(result).toEqual({ key: 'val' });
      expect(mockEngine.generateStructuredResponse).toHaveBeenCalledWith(
        messages,
        schema,
      );
    });
  });
});
