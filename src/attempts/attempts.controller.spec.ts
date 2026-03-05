import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AttemptsController', () => {
  let controller: AttemptsController;
  let service: AttemptsService;

  const mockService = {
    create: jest.fn(),
    findById: jest.fn(),
    updateAnswers: jest.fn(),
    submit: jest.fn(),
    findAllForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttemptsController],
      providers: [{ provide: AttemptsService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<AttemptsController>(AttemptsController);
    service = module.get<AttemptsService>(AttemptsService);
  });

  it('should list all attempts for user', async () => {
    const token = { uid: 'uid1' };
    const result = [{ id: 'a1' }];
    mockService.findAllForUser.mockResolvedValue(result);

    expect(await controller.findAll(token)).toEqual(result);
    expect(service.findAllForUser).toHaveBeenCalledWith('uid1');
  });

  it('should create an attempt', async () => {
    const token = { uid: 'uid1' };
    const dto = { testId: 't1' };
    const result = { id: 'a1' };
    mockService.create.mockResolvedValue(result);

    expect(await controller.create(token, dto)).toEqual(result);
    expect(service.create).toHaveBeenCalledWith('uid1', 't1');
  });

  it('should get attempt by id', async () => {
    const token = { uid: 'uid1' };
    const result = { id: 'a1', test: {} };
    mockService.findById.mockResolvedValue(result);

    expect(await controller.findById(token, 'a1')).toEqual(result);
    expect(service.findById).toHaveBeenCalledWith('uid1', 'a1');
  });

  it('should update answers', async () => {
    const token = { uid: 'uid1' };
    const dto = { answers: { q1: 'A' } };
    mockService.updateAnswers.mockResolvedValue({ id: 'a1' });

    await controller.updateAnswers(token, 'a1', dto);
    expect(service.updateAnswers).toHaveBeenCalledWith('uid1', 'a1', {
      q1: 'A',
    });
  });

  it('should submit attempt', async () => {
    const token = { uid: 'uid1' };
    mockService.submit.mockResolvedValue({ id: 'a1', status: 'COMPLETED' });

    const result = await controller.submit(token, 'a1');
    expect(result.status).toBe('COMPLETED');
    expect(service.submit).toHaveBeenCalledWith('uid1', 'a1');
  });
});
