import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto, UpdateAttemptDto } from './dto/attempt.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('attempts')
@UseGuards(FirebaseAuthGuard)
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  async create(
    @CurrentUser() decodedToken: any,
    @Body() dto: CreateAttemptDto,
  ) {
    return this.attemptsService.create(decodedToken.uid, dto.testId);
  }

  @Get(':id')
  async findById(
    @CurrentUser() decodedToken: any,
    @Param('id') id: string,
  ) {
    return this.attemptsService.findById(decodedToken.uid, id);
  }

  @Patch(':id')
  async updateAnswers(
    @CurrentUser() decodedToken: any,
    @Param('id') id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.attemptsService.updateAnswers(decodedToken.uid, id, dto.answers ?? {});
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() decodedToken: any,
    @Param('id') id: string,
  ) {
    return this.attemptsService.submit(decodedToken.uid, id);
  }
}
