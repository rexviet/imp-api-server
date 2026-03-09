import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { AllowRegisterRoles, RegisterUserDto } from './dto/register-user.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(
    @CurrentUser() decodedToken: any,
    @Body() dto: RegisterUserDto,
  ) {
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const name = dto.name || decodedToken.name;
    return this.usersService.findOrCreateUser(
      firebaseUid,
      email,
      name,
      dto.role === AllowRegisterRoles.TEACHER ? UserRole.TEACHER : dto.role,
    );
  }

  @Get('me')
  async getMe(@CurrentUser() decodedToken: any) {
    return this.usersService.getCurrentUser(decodedToken.uid);
  }

  @Get('teachers')
  async findTeachers(@Query('q') query?: string) {
    return this.usersService.findTeachers(query);
  }

  @Patch('me/teacher-profile')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER)
  async updateTeacherProfile(
    @CurrentUser() decodedToken: any,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.usersService.updateTeacherProfile(decodedToken.uid, dto);
  }
}
