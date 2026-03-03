import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SeedMockTestDto } from './dto/seed-mock-test.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('seed')
  async seed(@Body() dto: SeedMockTestDto) {
    return this.adminService.seedMockTest(dto);
  }

  @Get('mock-tests')
  async list() {
    return this.adminService.getAllMockTests();
  }
}

