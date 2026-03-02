import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FirebaseService } from '../firebase/firebase.service';
import { Reflector } from '@nestjs/core';

jest.mock('../prisma', () => ({
  prisma: {},
}));

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            seedMockTest: jest.fn(),
            getAllMockTests: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {}, // Mocked out since we are just checking guards metadata
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('seed', () => {
    it('should call adminService.seedMockTest', async () => {
      const data = { title: 'Test' };
      await controller.seed(data);
      expect(service.seedMockTest).toHaveBeenCalledWith(data);
    });
  });

  describe('list', () => {
    it('should call adminService.getAllMockTests', async () => {
      await controller.list();
      expect(service.getAllMockTests).toHaveBeenCalled();
    });
  });
});
