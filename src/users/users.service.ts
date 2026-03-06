import { Injectable, Inject } from '@nestjs/common';
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
}
