import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TestDifficulty, SectionType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async seedMockTest(data: {
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
  }) {
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

  async getAllMockTests() {
    return this.prisma.client.mockTest.findMany({
      include: {
        sections: true,
      },
    });
  }
}
