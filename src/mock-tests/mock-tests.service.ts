import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IMockTestsDatasource,
  MOCK_TESTS_DATASOURCE,
} from './mock-tests.datasource';

@Injectable()
export class MockTestsService {
  constructor(
    @Inject(MOCK_TESTS_DATASOURCE)
    private readonly datasource: IMockTestsDatasource,
  ) {}

  async findAll() {
    return this.datasource.findAll();
  }

  async findById(id: string) {
    const test = await this.datasource.findByIdForStudent(id);

    if (!test) {
      throw new NotFoundException(`Mock test with id "${id}" not found`);
    }

    return test;
  }
}
