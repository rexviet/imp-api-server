import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto, UpdateAttemptDto } from './dto/attempt.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface DecodedFirebaseToken {
  uid: string;
  email?: string;
}

@Controller('attempts')
@UseGuards(FirebaseAuthGuard)
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  async create(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Body() dto: CreateAttemptDto,
  ) {
    return this.attemptsService.create(decodedToken.uid, dto.testId);
  }

  @Get(':id')
  async findById(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
  ) {
    return this.attemptsService.findById(decodedToken.uid, id);
  }

  @Patch(':id')
  async updateAnswers(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.attemptsService.updateAnswers(
      decodedToken.uid,
      id,
      dto.answers ?? {},
    );
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() decodedToken: DecodedFirebaseToken,
    @Param('id') id: string,
  ) {
    return this.attemptsService.submit(decodedToken.uid, id);
  }
}
