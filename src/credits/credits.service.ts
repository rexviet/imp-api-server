import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICreditsDatasource, CREDITS_DATASOURCE } from './credits.datasource';

@Injectable()
export class CreditsService {
  constructor(
    @Inject(CREDITS_DATASOURCE)
    private readonly datasource: ICreditsDatasource,
  ) {}

  async topUpCredits(firebaseUid: string, amount: number) {
    const user = await this.datasource.findUserByFirebaseUid(firebaseUid);
    if (!user) throw new NotFoundException('User not found');

    return this.datasource.topUpCreditsTransaction(
      user.id,
      amount,
      `Mock Top-up: ${amount} credits`,
    );
  }

  async getTransactions(firebaseUid: string) {
    const user = await this.datasource.findUserByFirebaseUid(firebaseUid);
    if (!user) throw new NotFoundException('User not found');

    return this.datasource.findTransactionsByUserId(user.id, 50);
  }
}
