import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GradingStatus } from '@prisma/client';
import {
  ITeacherGradingDatasource,
  TEACHER_GRADING_DATASOURCE,
} from './teacher-grading.datasource';
import { IStorageProvider } from '../common/interfaces/storage-provider.interface';

@Injectable()
export class TeacherGradingService {
  constructor(
    @Inject(TEACHER_GRADING_DATASOURCE)
    private readonly datasource: ITeacherGradingDatasource,
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
  ) {}

  private async resolveTeacher(firebaseUid: string) {
    const teacher = await this.datasource.findTeacherProfileByFirebaseUid(
      firebaseUid,
    );
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }
    return teacher;
  }

  async listRequests(firebaseUid: string) {
    const teacher = await this.resolveTeacher(firebaseUid);
    const requests = await this.datasource.findRequestsByTeacher(teacher.id);

    return requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      feedback: request.feedback,
      finalScore: request.finalScore,
      rubric: request.rubric,
      attempt: {
        id: request.attempt.id,
        status: request.attempt.status,
        score: request.attempt.score,
        createdAt: request.attempt.createdAt,
        candidate: {
          id: request.attempt.user.id,
          name: request.attempt.user.name,
          email: request.attempt.user.email,
        },
        test: {
          id: request.attempt.test.id,
          title: request.attempt.test.title,
          sectionTypes: request.attempt.test.sections.map((s: any) => s.type),
        },
      },
    }));
  }

  async getRequestDetail(firebaseUid: string, requestId: string) {
    const teacher = await this.resolveTeacher(firebaseUid);
    const request = await this.datasource.findRequestDetail(
      requestId,
      teacher.id,
    );
    if (!request) {
      throw new NotFoundException('Grading request not found');
    }

    if (request.attempt.masterAudioPath) {
      try {
        request.attempt.masterAudioUrl =
          await this.storageProvider.getPresignedUrl(
            request.attempt.masterAudioPath,
          );
      } catch (err) {
        console.error(
          'Failed to generate presigned URL for teacher grading:',
          err,
        );
      }
    }

    return request;
  }

  async saveDraft(
    firebaseUid: string,
    requestId: string,
    dto: { feedback?: string; rubric?: Record<string, unknown> },
  ) {
    const teacher = await this.resolveTeacher(firebaseUid);
    try {
      return await this.datasource.updateRequest(requestId, teacher.id, {
        feedback: dto.feedback,
        rubric: dto.rubric,
        status: GradingStatus.IN_PROGRESS,
      });
    } catch (err) {
      if (err.message === 'REQUEST_NOT_FOUND_OR_FORBIDDEN') {
        throw new NotFoundException('Grading request not found');
      }
      throw err;
    }
  }

  async submit(
    firebaseUid: string,
    requestId: string,
    dto: {
      feedback?: string;
      rubric?: Record<string, unknown>;
      finalScore: number;
    },
  ) {
    const teacher = await this.resolveTeacher(firebaseUid);
    try {
      return await this.datasource.updateRequest(requestId, teacher.id, {
        feedback: dto.feedback,
        rubric: dto.rubric,
        finalScore: dto.finalScore,
        status: GradingStatus.COMPLETED,
      });
    } catch (err) {
      if (err.message === 'REQUEST_NOT_FOUND_OR_FORBIDDEN') {
        throw new NotFoundException('Grading request not found');
      }
      throw err;
    }
  }
}
