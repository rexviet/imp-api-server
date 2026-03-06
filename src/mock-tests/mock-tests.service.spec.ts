import { Test, TestingModule } from '@nestjs/testing';
import { MockTestsService } from './mock-tests.service';
import {
  MOCK_TESTS_DATASOURCE,
  IMockTestsDatasource,
} from './mock-tests.datasource';
import { NotFoundException } from '@nestjs/common';

describe('MockTestsService', () => {
  let service: MockTestsService;

  const mockDatasource: IMockTestsDatasource = {
    findAll: jest.fn(),
    findByIdForStudent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockTestsService,
        { provide: MOCK_TESTS_DATASOURCE, useValue: mockDatasource },
      ],
    }).compile();

    service = module.get<MockTestsService>(MockTestsService);
  });

  describe('findAll', () => {
    it('should return a list of mock tests', async () => {
      const mockTests = [
        { id: '1', title: 'Test 1', _count: { sections: 4 } },
        { id: '2', title: 'Test 2', _count: { sections: 2 } },
      ];
      (mockDatasource.findAll as jest.Mock).mockResolvedValue(mockTests);

      const result = await service.findAll();
      expect(result).toEqual(mockTests);
      expect(mockDatasource.findAll).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a full mock test', async () => {
      const mockTest = {
        id: '1',
        title: 'Full Test',
        sections: [{ id: 's1', questions: [{ id: 'q1', content: {} }] }],
      };
      (mockDatasource.findByIdForStudent as jest.Mock).mockResolvedValue(
        mockTest,
      );

      const result = await service.findById('1');
      expect(result).toEqual(mockTest);
    });

    it('should throw NotFoundException if test does not exist', async () => {
      (mockDatasource.findByIdForStudent as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
