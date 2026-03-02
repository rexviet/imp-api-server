import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

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
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: UserRole.STUDENT });

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
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: UserRole.ADMIN });

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
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

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
});
