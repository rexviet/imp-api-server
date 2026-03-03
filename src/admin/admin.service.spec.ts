import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestDifficulty, SectionType } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaClient = {
    mockTest: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: { client: mockPrismaClient } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('seedMockTest', () => {
    it('should create a mock test with nested sections/questions', async () => {
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

      mockPrismaClient.mockTest.create.mockResolvedValue({
        id: 'test-id',
        ...mockData,
      });

      const result = await service.seedMockTest(mockData);

      expect(mockPrismaClient.mockTest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Mock Test',
            sections: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  type: SectionType.READING,
                  questions: {
                    create: expect.arrayContaining([
                      expect.objectContaining({ order: 1 }),
                    ]),
                  },
                }),
              ]),
            },
          }),
        }),
      );
      expect(result).toHaveProperty('id', 'test-id');
    });
  });

  describe('getAllMockTests', () => {
    it('should return all mock tests with sections', async () => {
      mockPrismaClient.mockTest.findMany.mockResolvedValue([
        { title: 'Test 1' },
      ]);

      const result = await service.getAllMockTests();

      expect(mockPrismaClient.mockTest.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
