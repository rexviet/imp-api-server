import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockTest } from '@prisma/client';

export interface IMockTestsDatasource {
  findAll(): Promise<any[]>;
  findByIdForStudent(id: string): Promise<any | null>;
}

export const MOCK_TESTS_DATASOURCE = 'MOCK_TESTS_DATASOURCE';

@Injectable()
export class PrismaMockTestsDatasource implements IMockTestsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    return this.prisma.client.mockTest.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        createdAt: true,
        _count: { select: { sections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForStudent(id: string): Promise<any | null> {
    return this.prisma.client.mockTest.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                content: true,
                // answerKey is intentionally excluded — students should NOT see answers
              },
            },
          },
        },
      },
    });
  }
}
