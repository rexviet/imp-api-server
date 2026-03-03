import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  app: jest.fn(() => ({
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
    })),
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
  credential: {
    cert: jest.fn(),
  },
}));

describe('FirebaseService', () => {
  let service: FirebaseService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'FIREBASE_PROJECT_ID') return 'test-project';
              if (key === 'FIREBASE_PRIVATE_KEY') return 'test-key';
              if (key === 'FIREBASE_CLIENT_EMAIL') return 'test-email';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize firebase-admin SDK if not already initialized', () => {
      // @ts-expect-error - testing initialization
      admin.apps = [];
      service.onModuleInit();
      expect(admin.initializeApp).toHaveBeenCalled();
    });
  });

  describe('getAuth', () => {
    it('should return firebase auth instance', () => {
      service.onModuleInit();
      const auth = service.getAuth();
      expect(auth).toBeDefined();
      expect(admin.auth).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token on valid JWT', async () => {
      const mockDecodedToken = { uid: '123' };
      const verifyIdTokenSpy = jest.fn().mockResolvedValue(mockDecodedToken);
      (admin.auth as jest.Mock).mockReturnValue({
        verifyIdToken: verifyIdTokenSpy,
      });

      service.onModuleInit();
      const result = await service.verifyToken('valid-token');
      expect(result).toEqual(mockDecodedToken);
      expect(verifyIdTokenSpy).toHaveBeenCalledWith('valid-token');
    });

    it('should return null on invalid JWT', async () => {
      const verifyIdTokenSpy = jest
        .fn()
        .mockRejectedValue(new Error('Invalid token'));
      (admin.auth as jest.Mock).mockReturnValue({
        verifyIdToken: verifyIdTokenSpy,
      });

      service.onModuleInit();
      const result = await service.verifyToken('invalid-token');
      expect(result).toBeNull();
    });
  });
});
