import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { ExecutionContext } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findOrCreateUser: jest.fn(),
    getCurrentUser: jest.fn(),
    findTeachers: jest.fn(),
    updateTeacherProfile: jest.fn(),
  };

  const mockFirebaseAuthGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: (_context: ExecutionContext) => true })
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
    expect(service.findOrCreateUser).toHaveBeenCalledWith(
      'uid1',
      'test@test.com',
      undefined,
      UserRole.STUDENT,
    );
  });

  it('should get current user info', async () => {
    const mockToken = { uid: 'uid2' };
    const expectedResult = {
      id: '2',
      firebaseUid: 'uid2',
      email: 'foo@bar.com',
    };

    mockUsersService.getCurrentUser.mockResolvedValue(expectedResult);

    const result = await controller.getMe(mockToken);
    expect(result).toEqual(expectedResult);
    expect(service.getCurrentUser).toHaveBeenCalledWith('uid2');
  });

  it('should update teacher profile for current user', async () => {
    const mockToken = { uid: 'uid-teacher' };
    const mockDto = {
      headline: 'IELTS Examiner',
      bio: 'Updated bio',
      creditRate: 120,
    };
    const expectedResult = { id: 'u-teacher', role: UserRole.TEACHER };

    mockUsersService.updateTeacherProfile.mockResolvedValue(expectedResult);

    const result = await controller.updateTeacherProfile(mockToken, mockDto);
    expect(result).toEqual(expectedResult);
    expect(service.updateTeacherProfile).toHaveBeenCalledWith(
      'uid-teacher',
      mockDto,
    );
  });
});
