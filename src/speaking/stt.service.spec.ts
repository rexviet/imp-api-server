import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SttService } from './stt.service';

// Mock google-cloud speech client
jest.mock('@google-cloud/speech', () => {
  return {
    SpeechClient: jest.fn().mockImplementation(() => {
      return {
        recognize: jest.fn().mockResolvedValue([
          {
            results: [
              {
                alternatives: [{ transcript: 'Hello examiner.' }]
              }
            ]
          }
        ]),
      };
    }),
  };
});

describe('SttService', () => {
  let service: SttService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'FIREBASE_PROJECT_ID') return 'mock-project';
        if (key === 'FIREBASE_PRIVATE_KEY') return 'mock-key';
        if (key === 'FIREBASE_CLIENT_EMAIL') return 'mock@email';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SttService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SttService>(SttService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transcribeAudio', () => {
    it('should extract base64 header and return transcript on success', async () => {
      const result = await service.transcribeAudio('data:audio/webm;base64,AABBCC');
      expect(result).toBe('Hello examiner.');
    });

    it('should return fallback if no client initialized', async () => {
      const moduleFail: TestingModule = await Test.createTestingModule({
        providers: [
          SttService,
          { provide: ConfigService, useValue: { get: () => null } },
        ],
      }).compile();

      const failService = moduleFail.get<SttService>(SttService);
      const res = await failService.transcribeAudio('base64');
      expect(res).toContain('Mocked Speech-to-Text');
    });

    it('should catch errors cleanly and rethrow', async () => {
      // Temporarily break recognize method
      const serviceAny = service as any;
      serviceAny.client.recognize = jest.fn().mockRejectedValue(new Error('GCP Error'));

      await expect(service.transcribeAudio('base64')).rejects.toThrow('STT Transcription failed: GCP Error');
    });
  });
});
