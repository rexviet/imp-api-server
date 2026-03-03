import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './auth.guard';
import { FirebaseService } from '../firebase/firebase.service';

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let firebaseService: FirebaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        {
          provide: FirebaseService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
    firebaseService = module.get<FirebaseService>(FirebaseService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockContext = (authHeader?: string) => ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: authHeader },
        }),
      }),
    });

    it('should throw UnauthorizedException if Authorization header is missing', async () => {
      const context = createMockContext();
      await expect(guard.canActivate(context as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if Authorization header is malformed', async () => {
      const context = createMockContext('invalid-token');
      await expect(guard.canActivate(context as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      const context = createMockContext('Bearer invalid-token');
      (firebaseService.verifyToken as jest.Mock).mockResolvedValue(null);

      await expect(guard.canActivate(context as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return true and attach user to request on valid token', async () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      const request = {
        headers: { authorization: 'Bearer valid-token' },
        user: null,
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      };
      (firebaseService.verifyToken as jest.Mock).mockResolvedValue(mockUser);

      const result = await guard.canActivate(context as any);
      expect(result).toBe(true);
      expect(request['user']).toEqual(mockUser);
    });
  });
});
