import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.uid) {
      throw new UnauthorizedException('User not authenticated');
    }

    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: user.uid },
    });

    if (!dbUser || !requiredRoles.includes(dbUser.role)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }
    return true;
  }
}
