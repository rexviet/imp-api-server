import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MockTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
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

  async findById(id: string) {
    const test = await this.prisma.client.mockTest.findUnique({
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

    if (!test) {
      throw new NotFoundException(`Mock test with id "${id}" not found`);
    }

    return test;
  }
}
