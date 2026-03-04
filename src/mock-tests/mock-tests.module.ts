import { Module } from '@nestjs/common';
import { MockTestsController } from './mock-tests.controller';
import { MockTestsService } from './mock-tests.service';
import {
  PrismaMockTestsDatasource,
  MOCK_TESTS_DATASOURCE,
} from './mock-tests.datasource';

@Module({
  controllers: [MockTestsController],
  providers: [
    MockTestsService,
    { provide: MOCK_TESTS_DATASOURCE, useClass: PrismaMockTestsDatasource },
  ],
  exports: [MockTestsService],
})
export class MockTestsModule {}
