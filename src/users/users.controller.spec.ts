import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { UserRole } from '@prisma/client';
import { ExecutionContext } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findOrCreateUser: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  const mockFirebaseAuthGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should register a new user', async () => {
    const mockToken = { uid: 'uid1', email: 'test@test.com' };
    const mockDto = { role: UserRole.STUDENT };
    const expectedResult = { id: '1', firebaseUid: 'uid1' };

    mockUsersService.findOrCreateUser.mockResolvedValue(expectedResult);

    const result = await controller.register(mockToken, mockDto);
    expect(result).toEqual(expectedResult);
    expect(service.findOrCreateUser).toHaveBeenCalledWith('uid1', 'test@test.com', UserRole.STUDENT);
  });

  it('should get current user info', async () => {
    const mockToken = { uid: 'uid2' };
    const expectedResult = { id: '2', firebaseUid: 'uid2', email: 'foo@bar.com' };

    mockUsersService.getCurrentUser.mockResolvedValue(expectedResult);

    const result = await controller.getMe(mockToken);
    expect(result).toEqual(expectedResult);
    expect(service.getCurrentUser).toHaveBeenCalledWith('uid2');
  });
});
