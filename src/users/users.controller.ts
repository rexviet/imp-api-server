import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

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
      dto.role,
    );
  }

  @Get('me')
  async getMe(@CurrentUser() decodedToken: any) {
    return this.usersService.getCurrentUser(decodedToken.uid);
  }
}
