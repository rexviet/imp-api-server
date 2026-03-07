import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IUsersDatasource, USERS_DATASOURCE } from './users.datasource';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_DATASOURCE)
    private readonly datasource: IUsersDatasource,
  ) {}

  async findOrCreateUser(
    firebaseUid: string,
    email: string,
    name?: string,
    role?: UserRole,
  ) {
    let user = await this.datasource.findByFirebaseUid(firebaseUid);

    if (!user) {
      user = await this.datasource.create({
        firebaseUid,
        email,
        name,
        role: role ?? UserRole.STUDENT,
      });

      // If they are a teacher, also create TeacherProfile
      if (user.role === UserRole.TEACHER) {
        await this.datasource.createTeacherProfile(user.id);
      }
    }

    return user;
  }

  async getCurrentUser(firebaseUid: string) {
    return this.datasource.findByFirebaseUidWithProfile(firebaseUid);
  }

  async findTeachers(query?: string) {
    return this.datasource.findTeachers(query);
  }

  async updateTeacherProfile(
    firebaseUid: string,
    data: { headline?: string; bio?: string; creditRate?: number },
  ) {
    const user = await this.datasource.findByFirebaseUidWithProfile(
      firebaseUid,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only TEACHER accounts can update profile');
    }

    await this.datasource.upsertTeacherProfile(user.id, data);
    return this.datasource.findByFirebaseUidWithProfile(firebaseUid);
  }
}
