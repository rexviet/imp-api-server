import { Test, TestingModule } from '@nestjs/testing';
import { MockTestsService } from './mock-tests.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MockTestsService', () => {
  let service: MockTestsService;

  const mockPrismaClient = {
    mockTest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockTestsService,
        { provide: PrismaService, useValue: { client: mockPrismaClient } },
      ],
    }).compile();

    service = module.get<MockTestsService>(MockTestsService);
  });

  describe('findAll', () => {
    it('should return a list of mock tests with section count', async () => {
      const mockTests = [
        { id: '1', title: 'Test 1', description: null, difficulty: 'ACADEMIC', createdAt: new Date(), _count: { sections: 4 } },
        { id: '2', title: 'Test 2', description: 'Desc', difficulty: 'GENERAL', createdAt: new Date(), _count: { sections: 2 } },
      ];
      mockPrismaClient.mockTest.findMany.mockResolvedValue(mockTests);

      const result = await service.findAll();

      expect(result).toEqual(mockTests);
      expect(mockPrismaClient.mockTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a full mock test with sections and questions (no answer keys)', async () => {
      const mockTest = {
        id: '1',
        title: 'Full Test',
        sections: [
          {
            id: 's1',
            type: 'READING',
            order: 1,
            questions: [
              { id: 'q1', order: 1, content: { text: 'Question 1' } },
            ],
          },
        ],
      };
      mockPrismaClient.mockTest.findUnique.mockResolvedValue(mockTest);

      const result = await service.findById('1');

      expect(result).toEqual(mockTest);
      expect(mockPrismaClient.mockTest.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          include: expect.objectContaining({
            sections: expect.objectContaining({
              include: expect.objectContaining({
                questions: expect.objectContaining({
                  select: expect.not.objectContaining({ answerKey: true }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException if test does not exist', async () => {
      mockPrismaClient.mockTest.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
