import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { USERS_DATASOURCE, IUsersDatasource } from './users.datasource';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let datasource: IUsersDatasource;

  const mockDatasource: IUsersDatasource = {
    findByFirebaseUid: jest.fn(),
    findByFirebaseUidWithProfile: jest.fn(),
    create: jest.fn(),
    createTeacherProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USERS_DATASOURCE, useValue: mockDatasource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    datasource = module.get(USERS_DATASOURCE);
  });

  it('should return existing user', async () => {
    const mockUser = {
      id: '1',
      firebaseUid: 'uid1',
      email: 'test@test.com',
      role: UserRole.STUDENT,
    };
    (mockDatasource.findByFirebaseUid as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser('uid1', 'test@test.com');
    expect(result).toEqual(mockUser);
    expect(mockDatasource.create).not.toHaveBeenCalled();
  });

  it('should create new student user', async () => {
    (mockDatasource.findByFirebaseUid as jest.Mock).mockResolvedValue(null);
    const mockUser = {
      id: '2',
      firebaseUid: 'uid2',
      email: 'test2@test.com',
      role: UserRole.STUDENT,
    };
    (mockDatasource.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser('uid2', 'test2@test.com');
    expect(result).toEqual(mockUser);
    expect(mockDatasource.create).toHaveBeenCalledWith({
      firebaseUid: 'uid2',
      email: 'test2@test.com',
      name: undefined,
      role: UserRole.STUDENT,
    });
    expect(mockDatasource.createTeacherProfile).not.toHaveBeenCalled();
  });

  it('should create new teacher user and teacher profile', async () => {
    (mockDatasource.findByFirebaseUid as jest.Mock).mockResolvedValue(null);
    const mockUser = {
      id: '3',
      firebaseUid: 'uid3',
      email: 'test3@test.com',
      role: UserRole.TEACHER,
    };
    (mockDatasource.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser(
      'uid3',
      'test3@test.com',
      undefined,
      UserRole.TEACHER,
    );
    expect(result).toEqual(mockUser);
    expect(mockDatasource.create).toHaveBeenCalledWith({
      firebaseUid: 'uid3',
      email: 'test3@test.com',
      name: undefined,
      role: UserRole.TEACHER,
    });
    expect(mockDatasource.createTeacherProfile).toHaveBeenCalledWith('3');
  });

  it('should return current user with profile', async () => {
    const mockUser = {
      id: '1',
      firebaseUid: 'uid1',
      email: 'test@test.com',
      teacherProfile: null,
    };
    (mockDatasource.findByFirebaseUidWithProfile as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.getCurrentUser('uid1');
    expect(result).toEqual(mockUser);
    expect(mockDatasource.findByFirebaseUidWithProfile).toHaveBeenCalledWith('uid1');
  });
});
