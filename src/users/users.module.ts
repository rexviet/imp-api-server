import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaUsersDatasource, USERS_DATASOURCE } from './users.datasource';

@Module({
  providers: [
    UsersService,
    { provide: USERS_DATASOURCE, useClass: PrismaUsersDatasource },
  ],
  controllers: [UsersController],
})
export class UsersModule {}
