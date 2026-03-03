import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    teacherProfile: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    client: mockPrismaClient,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should return existing user', async () => {
    const mockUser = {
      id: '1',
      firebaseUid: 'uid1',
      email: 'test@test.com',
      role: UserRole.STUDENT,
    };
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser('uid1', 'test@test.com');
    expect(result).toEqual(mockUser);
    expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
  });

  it('should create new student user', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    const mockUser = {
      id: '2',
      firebaseUid: 'uid2',
      email: 'test2@test.com',
      role: UserRole.STUDENT,
    };
    mockPrismaClient.user.create.mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser('uid2', 'test2@test.com');
    expect(result).toEqual(mockUser);
    expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'uid2',
        email: 'test2@test.com',
        role: UserRole.STUDENT,
      },
    });
    expect(mockPrismaClient.teacherProfile.create).not.toHaveBeenCalled();
  });

  it('should create new teacher user and teacher profile', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    const mockUser = {
      id: '3',
      firebaseUid: 'uid3',
      email: 'test3@test.com',
      role: UserRole.TEACHER,
    };
    mockPrismaClient.user.create.mockResolvedValue(mockUser);

    const result = await service.findOrCreateUser(
      'uid3',
      'test3@test.com',
      undefined,
      UserRole.TEACHER,
    );
    expect(result).toEqual(mockUser);
    expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'uid3',
        email: 'test3@test.com',
        name: undefined,
        role: UserRole.TEACHER,
      },
    });
    expect(mockPrismaClient.teacherProfile.create).toHaveBeenCalledWith({
      data: { userId: '3' },
    });
  });

  it('should return current user with profile', async () => {
    const mockUser = {
      id: '1',
      firebaseUid: 'uid1',
      email: 'test@test.com',
      teacherProfile: null,
    };
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.getCurrentUser('uid1');
    expect(result).toEqual(mockUser);
    expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid1' },
      include: { teacherProfile: true },
    });
  });
});
