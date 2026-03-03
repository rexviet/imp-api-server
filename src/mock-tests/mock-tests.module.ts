import { Module } from '@nestjs/common';
import { MockTestsController } from './mock-tests.controller';
import { MockTestsService } from './mock-tests.service';

@Module({
  controllers: [MockTestsController],
  providers: [MockTestsService],
  exports: [MockTestsService],
})
export class MockTestsModule {}
