import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { TopUpDto } from './dto/top-up.dto';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('credits')
@UseGuards(FirebaseAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Post('topup')
  async topUp(
    @CurrentUser() decodedToken: any,
    @Body() dto: TopUpDto,
  ) {
    return this.creditsService.topUpCredits(decodedToken.uid, dto.amount);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() decodedToken: any) {
    return this.creditsService.getTransactions(decodedToken.uid);
  }
}
