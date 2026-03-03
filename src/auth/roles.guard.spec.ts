import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: { client: mockPrismaClient },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  it('should allow access if no roles are required', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => ({ user: { uid: '123' } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should block if user role does not match', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    mockPrismaClient.user.findUnique.mockResolvedValue({
      role: UserRole.STUDENT,
    });

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { uid: '123' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const promise = guard.canActivate(mockContext);
    await expect(promise).rejects.toThrow(ForbiddenException);
  });

  it('should allow access if user role matches', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    mockPrismaClient.user.findUnique.mockResolvedValue({
      role: UserRole.ADMIN,
    });

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { uid: '123' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should block if user fails to exist in db', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    mockPrismaClient.user.findUnique.mockResolvedValue(null);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { uid: '123' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const promise = guard.canActivate(mockContext);
    await expect(promise).rejects.toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException if user context is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const promise = guard.canActivate(mockContext);
    await expect(promise).rejects.toThrow(UnauthorizedException);
  });
});
