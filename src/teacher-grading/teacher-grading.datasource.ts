import { Injectable } from '@nestjs/common';
import { GradingRequest, GradingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TeacherProfileIdentity = {
  id: string;
  user: { id: string; role: UserRole };
};

export interface ITeacherGradingDatasource {
  findTeacherProfileByFirebaseUid(
    firebaseUid: string,
  ): Promise<TeacherProfileIdentity | null>;
  findRequestsByTeacher(teacherId: string): Promise<any[]>;
  findRequestDetail(requestId: string, teacherId: string): Promise<any | null>;
  updateRequest(
    requestId: string,
    teacherId: string,
    data: {
      feedback?: string;
      rubric?: Record<string, unknown>;
      finalScore?: number;
      status?: GradingStatus;
    },
  ): Promise<GradingRequest>;
}

export const TEACHER_GRADING_DATASOURCE = 'TEACHER_GRADING_DATASOURCE';

@Injectable()
export class PrismaTeacherGradingDatasource
  implements ITeacherGradingDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async findTeacherProfileByFirebaseUid(firebaseUid: string) {
    return this.prisma.client.teacherProfile.findFirst({
      where: { user: { firebaseUid } },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });
  }

  async findRequestsByTeacher(teacherId: string) {
    return this.prisma.client.gradingRequest.findMany({
      where: { teacherId },
      include: {
        attempt: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            test: {
              include: {
                sections: {
                  select: {
                    id: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRequestDetail(requestId: string, teacherId: string) {
    return this.prisma.client.gradingRequest.findFirst({
      where: { id: requestId, teacherId },
      include: {
        teacher: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        attempt: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            test: {
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async updateRequest(
    requestId: string,
    teacherId: string,
    data: {
      feedback?: string;
      rubric?: Record<string, unknown>;
      finalScore?: number;
      status?: GradingStatus;
    },
  ) {
    const request = await this.prisma.client.gradingRequest.findFirst({
      where: { id: requestId, teacherId },
      select: { id: true },
    });
    if (!request) {
      throw new Error('REQUEST_NOT_FOUND_OR_FORBIDDEN');
    }

    return this.prisma.client.gradingRequest.update({
      where: { id: request.id },
      data: {
        ...(data.feedback !== undefined ? { feedback: data.feedback } : {}),
        ...(data.finalScore !== undefined
          ? { finalScore: data.finalScore }
          : {}),
        ...(data.rubric !== undefined ? { rubric: data.rubric as any } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }
}
