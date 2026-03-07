import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { TeacherGradingController } from './teacher-grading.controller';
import { TeacherGradingService } from './teacher-grading.service';

describe('TeacherGradingController', () => {
  let controller: TeacherGradingController;
  let service: TeacherGradingService;

  const mockService = {
    listRequests: jest.fn(),
    getRequestDetail: jest.fn(),
    saveDraft: jest.fn(),
    submit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherGradingController],
      providers: [{ provide: TeacherGradingService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<TeacherGradingController>(TeacherGradingController);
    service = module.get<TeacherGradingService>(TeacherGradingService);
  });

  it('should list grading requests', async () => {
    const token = { uid: 'uid-teacher' };
    const expected = [{ id: 'gr-1' }];
    mockService.listRequests.mockResolvedValue(expected);

    expect(await controller.list(token)).toEqual(expected);
    expect(service.listRequests).toHaveBeenCalledWith('uid-teacher');
  });

  it('should return request detail', async () => {
    const token = { uid: 'uid-teacher' };
    const expected = { id: 'gr-1' };
    mockService.getRequestDetail.mockResolvedValue(expected);

    expect(await controller.detail(token, 'gr-1')).toEqual(expected);
    expect(service.getRequestDetail).toHaveBeenCalledWith(
      'uid-teacher',
      'gr-1',
    );
  });

  it('should save grading draft', async () => {
    const token = { uid: 'uid-teacher' };
    const dto = { feedback: 'draft', rubric: { task: 7 } };
    const expected = { id: 'gr-1' };
    mockService.saveDraft.mockResolvedValue(expected);

    expect(await controller.saveDraft(token, 'gr-1', dto)).toEqual(expected);
    expect(service.saveDraft).toHaveBeenCalledWith('uid-teacher', 'gr-1', dto);
  });

  it('should submit grading result', async () => {
    const token = { uid: 'uid-teacher' };
    const dto = { feedback: 'final', rubric: { task: 7 }, finalScore: 7 };
    const expected = { id: 'gr-1', status: 'COMPLETED' };
    mockService.submit.mockResolvedValue(expected);

    expect(await controller.submit(token, 'gr-1', dto)).toEqual(expected);
    expect(service.submit).toHaveBeenCalledWith('uid-teacher', 'gr-1', dto);
  });
});
