import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { ADMIN_DATASOURCE, IAdminDatasource } from './admin.datasource';
import { TestDifficulty, SectionType } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;

  const mockDatasource: IAdminDatasource = {
    createMockTest: jest.fn(),
    findAllMockTests: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: ADMIN_DATASOURCE, useValue: mockDatasource },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('seedMockTest', () => {
    it('should delegate to datasource createMockTest', async () => {
      const mockData = {
        title: 'Mock Test',
        difficulty: TestDifficulty.ACADEMIC,
        sections: [
          {
            type: SectionType.READING,
            order: 1,
            questions: [{ order: 1, content: { q: 'hello' } }],
          },
        ],
      };

      (mockDatasource.createMockTest as jest.Mock).mockResolvedValue({
        id: 'test-id',
        ...mockData,
      });

      const result = await service.seedMockTest(mockData);

      expect(mockDatasource.createMockTest).toHaveBeenCalledWith(mockData);
      expect(result).toHaveProperty('id', 'test-id');
    });
  });

  describe('getAllMockTests', () => {
    it('should delegate to datasource findAllMockTests', async () => {
      (mockDatasource.findAllMockTests as jest.Mock).mockResolvedValue([
        { title: 'Test 1' },
      ]);

      const result = await service.getAllMockTests();

      expect(mockDatasource.findAllMockTests).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
