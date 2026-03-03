import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(
    firebaseUid: string,
    email: string,
    name?: string,
    role?: UserRole,
  ) {
    let user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      user = await this.prisma.client.user.create({
        data: {
          firebaseUid,
          email,
          name,
          role: role ?? UserRole.STUDENT,
        },
      });

      // If they are a teacher, also create TeacherProfile
      if (user.role === UserRole.TEACHER) {
        await this.prisma.client.teacherProfile.create({
          data: {
            userId: user.id,
          },
        });
      }
    }

    return user;
  }

  async getCurrentUser(firebaseUid: string) {
    return this.prisma.client.user.findUnique({
      where: { firebaseUid },
      include: { teacherProfile: true },
    });
  }
}
