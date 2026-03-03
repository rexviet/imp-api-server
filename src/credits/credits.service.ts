import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  async topUpCredits(firebaseUid: string, amount: number) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.client.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          amount,
          type: TransactionType.TOPUP,
          description: `Mock Top-up: ${amount} credits`,
        },
      });

      return { user: updatedUser, transaction };
    });
  }

  async getTransactions(firebaseUid: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.client.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
