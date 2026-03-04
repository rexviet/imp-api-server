import { Injectable, Inject } from '@nestjs/common';
import {
  IAdminDatasource,
  ADMIN_DATASOURCE,
  SeedMockTestInput,
} from './admin.datasource';

@Injectable()
export class AdminService {
  constructor(
    @Inject(ADMIN_DATASOURCE)
    private readonly datasource: IAdminDatasource,
  ) {}

  async seedMockTest(data: SeedMockTestInput) {
    return this.datasource.createMockTest(data);
  }

  async getAllMockTests() {
    return this.datasource.findAllMockTests();
  }
}
