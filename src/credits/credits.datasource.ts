import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Transaction, TransactionType } from '@prisma/client';

export interface ICreditsDatasource {
  findUserByFirebaseUid(firebaseUid: string): Promise<User | null>;
  topUpCreditsTransaction(
    userId: string,
    amount: number,
    description: string,
  ): Promise<{ user: User; transaction: Transaction }>;
  findTransactionsByUserId(
    userId: string,
    limit: number,
  ): Promise<Transaction[]>;
}

export const CREDITS_DATASOURCE = 'CREDITS_DATASOURCE';

@Injectable()
export class PrismaCreditsDatasource implements ICreditsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({
      where: { firebaseUid },
    });
  }

  async topUpCreditsTransaction(
    userId: string,
    amount: number,
    description: string,
  ): Promise<{ user: User; transaction: Transaction }> {
    return this.prisma.client.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.TOPUP,
          description,
        },
      });

      return { user: updatedUser, transaction };
    });
  }

  async findTransactionsByUserId(
    userId: string,
    limit: number,
  ): Promise<Transaction[]> {
    return this.prisma.client.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
