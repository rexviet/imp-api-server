import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import {
  PrismaAttemptsDatasource,
  ATTEMPTS_DATASOURCE,
} from './attempts.datasource';

@Module({
  controllers: [AttemptsController],
  providers: [
    AttemptsService,
    { provide: ATTEMPTS_DATASOURCE, useClass: PrismaAttemptsDatasource },
  ],
  exports: [AttemptsService],
})
export class AttemptsModule {}
