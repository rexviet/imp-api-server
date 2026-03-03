import { Test, TestingModule } from '@nestjs/testing';
import { MockTestsController } from './mock-tests.controller';
import { MockTestsService } from './mock-tests.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('MockTestsController', () => {
  let controller: MockTestsController;
  let service: MockTestsService;

  const mockService = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockTestsController],
      providers: [{ provide: MockTestsService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<MockTestsController>(MockTestsController);
    service = module.get<MockTestsService>(MockTestsService);
  });

  it('should list all mock tests', async () => {
    const tests = [{ id: '1', title: 'Test' }];
    mockService.findAll.mockResolvedValue(tests);

    const result = await controller.listAll();
    expect(result).toEqual(tests);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should get a mock test by id', async () => {
    const test = { id: '1', title: 'Full Test', sections: [] };
    mockService.findById.mockResolvedValue(test);

    const result = await controller.getById('1');
    expect(result).toEqual(test);
    expect(service.findById).toHaveBeenCalledWith('1');
  });
});
