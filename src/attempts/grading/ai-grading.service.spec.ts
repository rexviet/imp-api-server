import { Test, TestingModule } from '@nestjs/testing';
import { AIGradingService } from './ai-grading.service';
import { AIService } from '../../ai/ai.service';

describe('AIGradingService', () => {
  let service: AIGradingService;
  let aiService: AIService;

  const mockAIService = {
    generateStructuredResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGradingService,
        {
          provide: AIService,
          useValue: mockAIService,
        },
      ],
    }).compile();

    service = module.get<AIGradingService>(AIGradingService);
    aiService = module.get<AIService>(AIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('gradeWriting', () => {
    it('should call aiService.generateStructuredResponse with correct prompt and schema', async () => {
      const taskDescription = 'Write an essay about science.';
      const studentEssay = 'Science is very important...';
      const mockResult = { overallBand: 7.5 };
      mockAIService.generateStructuredResponse.mockResolvedValue(mockResult);

      const result = await service.gradeWriting(taskDescription, studentEssay);

      expect(result).toEqual(mockResult);
      expect(aiService.generateStructuredResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ 
            role: 'user', 
            content: expect.stringContaining(taskDescription) 
          }),
        ]),
        expect.objectContaining({
          type: 'object',
          required: expect.arrayContaining(['overallBand']),
        }),
      );
    });
  });

  describe('gradeSpeaking', () => {
    it('should format transcript and call aiService.generateStructuredResponse', async () => {
      const history = [
        { role: 'model', content: 'Hello, what is your name?' },
        { role: 'user', content: 'My name is John.' },
      ];
      const mockResult = { overallBand: 6.5 };
      mockAIService.generateStructuredResponse.mockResolvedValue(mockResult);

      const result = await service.gradeSpeaking(history);

      expect(result).toEqual(mockResult);
      expect(aiService.generateStructuredResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ 
            role: 'user', 
            content: expect.stringContaining('MODEL: Hello, what is your name?') 
          }),
        ]),
        expect.anything(),
      );
      expect(aiService.generateStructuredResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          required: expect.arrayContaining(['fluencyCoherence', 'pronunciation']),
        }),
      );
    });
  });
});
