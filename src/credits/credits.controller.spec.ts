import { Test, TestingModule } from '@nestjs/testing';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('CreditsController', () => {
  let controller: CreditsController;
  let service: CreditsService;

  const mockCreditsService = {
    topUpCredits: jest.fn(),
    getTransactions: jest.fn(),
  };

  const mockFirebaseAuthGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditsController],
      providers: [
        { provide: CreditsService, useValue: mockCreditsService },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(mockFirebaseAuthGuard)
      .compile();

    controller = module.get<CreditsController>(CreditsController);
    service = module.get<CreditsService>(CreditsService);
  });

  it('should process topUp credit request', async () => {
    const mockToken = { uid: 'uid1' };
    const mockDto = { amount: 200 };
    const expectedResult = { user: {}, transaction: {} };

    mockCreditsService.topUpCredits.mockResolvedValue(expectedResult);

    const result = await controller.topUp(mockToken, mockDto);
    expect(result).toEqual(expectedResult);
    expect(service.topUpCredits).toHaveBeenCalledWith('uid1', 200);
  });

  it('should get transaction history', async () => {
    const mockToken = { uid: 'uid2' };
    const expectedResult = [{ id: 'tx1' }, { id: 'tx2' }];

    mockCreditsService.getTransactions.mockResolvedValue(expectedResult);

    const result = await controller.getTransactions(mockToken);
    expect(result).toEqual(expectedResult);
    expect(service.getTransactions).toHaveBeenCalledWith('uid2');
  });
});
