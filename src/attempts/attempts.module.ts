import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import {
  PrismaAttemptsDatasource,
  ATTEMPTS_DATASOURCE,
} from './attempts.datasource';
import { AIGradingService } from './grading/ai-grading.service';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AIModule, StorageModule],
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    AIGradingService,
    { provide: ATTEMPTS_DATASOURCE, useClass: PrismaAttemptsDatasource },
  ],
  exports: [AttemptsService],
})
export class AttemptsModule {}
