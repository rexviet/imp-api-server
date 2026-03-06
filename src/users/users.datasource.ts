import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';

export interface IUsersDatasource {
  findByFirebaseUid(firebaseUid: string): Promise<User | null>;
  findByFirebaseUidWithProfile(firebaseUid: string): Promise<User | null>;
  create(data: {
    firebaseUid: string;
    email: string;
    name?: string;
    role: UserRole;
  }): Promise<User>;
  createTeacherProfile(userId: string): Promise<void>;
  findTeachers(query?: string): Promise<
    Array<{
      id: string;
      bio: string | null;
      creditRate: number;
      user: { id: string; name: string | null; email: string };
    }>
  >;
}

export const USERS_DATASOURCE = 'USERS_DATASOURCE';

@Injectable()
export class PrismaUsersDatasource implements IUsersDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
  }

  async findByFirebaseUidWithProfile(
    firebaseUid: string,
  ): Promise<User | null> {
    return this.prisma.client.user.findUnique({
      where: { firebaseUid },
      include: { teacherProfile: true },
    });
  }

  async create(data: {
    firebaseUid: string;
    email: string;
    name?: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.client.user.create({ data });
  }

  async createTeacherProfile(userId: string): Promise<void> {
    await this.prisma.client.teacherProfile.create({
      data: { userId },
    });
  }

  async findTeachers(query?: string) {
    return this.prisma.client.teacherProfile.findMany({
      where: {
        user: {
          role: UserRole.TEACHER,
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
