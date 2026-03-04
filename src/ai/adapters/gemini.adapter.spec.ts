import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiAdapter } from './gemini.adapter';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the @google/generative-ai module
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: () => 'Mocked text',
            },
          }),
          generateContentStream: jest.fn().mockResolvedValue({
            stream: [
              { text: () => 'chunk1 ' },
              { text: () => 'chunk2' },
            ],
          }),
        }),
      };
    }),
  };
});

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  let configService: ConfigService;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-api-key'),
          },
        },
      ],
    }).compile();

    adapter = module.get<GeminiAdapter>(GeminiAdapter);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('generateResponse', () => {
    it('should generate text from messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are an examiner.' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const res = await adapter.generateResponse(messages);
      expect(res).toBe('Mocked text');
      // The mock should have been initialized with the api key
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('mock-api-key');
    });
  });

  describe('generateResponseStream', () => {
    it('should stream text chunks', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      const chunks = [];
      const stream = adapter.generateResponseStream(messages);
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1 ', 'chunk2']);
    });
  });

  describe('generateStructuredResponse', () => {
    it('should return parsed JSON object', async () => {
      // Temporarily override the mock for generateContent just for this test
      const adapterAny = adapter as any;
      const getModelMock = jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => '{"score": 7}' },
        }),
      });
      adapterAny.getModel = getModelMock;

      const res = await adapter.generateStructuredResponse<{ score: number }>([
        { role: 'user' as const, content: 'grade me' },
      ]);
      expect(res).toEqual({ score: 7 });
    });

    it('should throw an error on invalid JSON', async () => {
      const adapterAny = adapter as any;
      const getModelMock = jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => 'invalid json' },
        }),
      });
      adapterAny.getModel = getModelMock;

      await expect(
        adapter.generateStructuredResponse([{ role: 'user' as const, content: 'hi' }]),
      ).rejects.toThrow('Invalid JSON format returned from AI');
    });
  });
});
