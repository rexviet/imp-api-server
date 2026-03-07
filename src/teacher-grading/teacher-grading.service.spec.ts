import { Test, TestingModule } from '@nestjs/testing';
import { GradingStatus, UserRole } from '@prisma/client';
import {
  ITeacherGradingDatasource,
  TEACHER_GRADING_DATASOURCE,
} from './teacher-grading.datasource';
import { TeacherGradingService } from './teacher-grading.service';

describe('TeacherGradingService', () => {
  let service: TeacherGradingService;

  const mockDatasource: ITeacherGradingDatasource = {
    findTeacherProfileByFirebaseUid: jest.fn(),
    findRequestsByTeacher: jest.fn(),
    findRequestDetail: jest.fn(),
    updateRequest: jest.fn(),
  };

  const mockStorageProvider = {
    getPresignedUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherGradingService,
        {
          provide: TEACHER_GRADING_DATASOURCE,
          useValue: mockDatasource,
        },
        {
          provide: 'IStorageProvider',
          useValue: mockStorageProvider,
        },
      ],
    }).compile();

    service = module.get<TeacherGradingService>(TeacherGradingService);
  });

  it('should list grading requests for teacher', async () => {
    (
      mockDatasource.findTeacherProfileByFirebaseUid as jest.Mock
    ).mockResolvedValue({
      id: 'tp-1',
      user: { id: 'u-1', role: UserRole.TEACHER },
    });
    (mockDatasource.findRequestsByTeacher as jest.Mock).mockResolvedValue([
      {
        id: 'gr-1',
        status: GradingStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        feedback: null,
        finalScore: null,
        rubric: null,
        attempt: {
          id: 'a-1',
          status: 'COMPLETED',
          score: 6.5,
          createdAt: new Date(),
          user: { id: 's-1', name: 'Student A', email: 'a@example.com' },
          test: {
            id: 't-1',
            title: 'Mock 1',
            sections: [{ id: 'sec-1', type: 'WRITING' }],
          },
        },
      },
    ]);

    const result = await service.listRequests('firebase-teacher');
    expect(result).toHaveLength(1);
    expect(result[0].attempt.candidate.name).toBe('Student A');
  });

  it('should add signed audio URL in detail response when path exists', async () => {
    (
      mockDatasource.findTeacherProfileByFirebaseUid as jest.Mock
    ).mockResolvedValue({
      id: 'tp-1',
      user: { id: 'u-1', role: UserRole.TEACHER },
    });
    (mockDatasource.findRequestDetail as jest.Mock).mockResolvedValue({
      id: 'gr-1',
      attempt: {
        id: 'a-1',
        masterAudioPath: 'speaking/master/a-1.webm',
      },
    });
    (mockStorageProvider.getPresignedUrl as jest.Mock).mockResolvedValue(
      'https://signed.example.com/a-1',
    );

    const result = await service.getRequestDetail('firebase-teacher', 'gr-1');
    expect(result.attempt.masterAudioUrl).toBe(
      'https://signed.example.com/a-1',
    );
  });

  it('should save draft as IN_PROGRESS status', async () => {
    (
      mockDatasource.findTeacherProfileByFirebaseUid as jest.Mock
    ).mockResolvedValue({
      id: 'tp-1',
      user: { id: 'u-1', role: UserRole.TEACHER },
    });
    (mockDatasource.updateRequest as jest.Mock).mockResolvedValue({
      id: 'gr-1',
    });

    await service.saveDraft('firebase-teacher', 'gr-1', {
      feedback: 'draft feedback',
    });

    expect(mockDatasource.updateRequest).toHaveBeenCalledWith(
      'gr-1',
      'tp-1',
      expect.objectContaining({
        feedback: 'draft feedback',
        status: GradingStatus.IN_PROGRESS,
      }),
    );
  });
});
