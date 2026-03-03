import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MockTestsService } from './mock-tests.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('mock-tests')
@UseGuards(FirebaseAuthGuard)
export class MockTestsController {
  constructor(private readonly mockTestsService: MockTestsService) {}

  @Get()
  async listAll() {
    return this.mockTestsService.findAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.mockTestsService.findById(id);
  }
}
