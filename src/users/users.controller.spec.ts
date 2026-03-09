import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

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
    canActivate: () => true,
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
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should register a new user', async () => {
    const mockToken = { uid: 'uid1', email: 'test@test.com' };
    const mockDto = { name: 'Updated Name' };
    const expectedResult = { id: '1', firebaseUid: 'uid1' };

    mockUsersService.findOrCreateUser.mockResolvedValue(expectedResult);

    const result = await controller.register(mockToken, mockDto);
    expect(result).toEqual(expectedResult);
    expect(service.findOrCreateUser).toHaveBeenCalledWith(
      'uid1',
      'test@test.com',
      'Updated Name',
      undefined,
    );
  });

  it('should allow teacher role from register payload', async () => {
    const mockToken = {
      uid: 'uid-teacher',
      email: 'teacher@test.com',
    };
    const payload = { name: 'Teacher', role: UserRole.TEACHER };
    const expectedResult = { id: '2', firebaseUid: 'uid-teacher' };

    mockUsersService.findOrCreateUser.mockResolvedValue(expectedResult);

    const result = await controller.register(mockToken, payload as any);

    expect(result).toEqual(expectedResult);
    expect(service.findOrCreateUser).toHaveBeenCalledWith(
      'uid-teacher',
      'teacher@test.com',
      'Teacher',
      UserRole.TEACHER,
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
