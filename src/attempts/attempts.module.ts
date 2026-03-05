import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import {
  PrismaAttemptsDatasource,
  ATTEMPTS_DATASOURCE,
} from './attempts.datasource';
import { AIGradingService } from './grading/ai-grading.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    AIGradingService,
    { provide: ATTEMPTS_DATASOURCE, useClass: PrismaAttemptsDatasource },
  ],
  exports: [AttemptsService],
})
export class AttemptsModule {}
