import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaAdminDatasource, ADMIN_DATASOURCE } from './admin.datasource';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    { provide: ADMIN_DATASOURCE, useClass: PrismaAdminDatasource },
  ],
})
export class AdminModule {}
