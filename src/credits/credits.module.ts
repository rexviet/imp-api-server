import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import {
  PrismaCreditsDatasource,
  CREDITS_DATASOURCE,
} from './credits.datasource';

@Module({
  providers: [
    CreditsService,
    { provide: CREDITS_DATASOURCE, useClass: PrismaCreditsDatasource },
  ],
  controllers: [CreditsController],
})
export class CreditsModule {}
