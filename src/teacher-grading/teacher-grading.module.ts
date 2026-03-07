import { Module } from '@nestjs/common';
import { TeacherGradingController } from './teacher-grading.controller';
import { TeacherGradingService } from './teacher-grading.service';
import {
  PrismaTeacherGradingDatasource,
  TEACHER_GRADING_DATASOURCE,
} from './teacher-grading.datasource';

@Module({
  controllers: [TeacherGradingController],
  providers: [
    TeacherGradingService,
    {
      provide: TEACHER_GRADING_DATASOURCE,
      useClass: PrismaTeacherGradingDatasource,
    },
  ],
})
export class TeacherGradingModule {}
