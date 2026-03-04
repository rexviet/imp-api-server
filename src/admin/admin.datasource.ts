import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestDifficulty, SectionType } from '@prisma/client';

export interface SeedMockTestInput {
  title: string;
  description?: string;
  difficulty: TestDifficulty;
  sections: {
    type: SectionType;
    order: number;
    questions: {
      order: number;
      content: any;
      answerKey?: any;
    }[];
  }[];
}

export interface IAdminDatasource {
  createMockTest(data: SeedMockTestInput): Promise<any>;
  findAllMockTests(): Promise<any[]>;
}

export const ADMIN_DATASOURCE = 'ADMIN_DATASOURCE';

@Injectable()
export class PrismaAdminDatasource implements IAdminDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createMockTest(data: SeedMockTestInput): Promise<any> {
    return this.prisma.client.mockTest.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        sections: {
          create: data.sections.map((section) => ({
            type: section.type,
            order: section.order,
            questions: {
              create: section.questions.map((question) => ({
                order: question.order,
                content: question.content,
                answerKey: question.answerKey,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          include: {
            questions: true,
          },
        },
      },
    });
  }

  async findAllMockTests(): Promise<any[]> {
    return this.prisma.client.mockTest.findMany({
      include: {
        sections: true,
      },
    });
  }
}
