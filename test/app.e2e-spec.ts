import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { FirebaseAuthGuard } from '../src/auth/auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransactionType } from '@prisma/client';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          // Mock decoded token injection into request object
          req.user = { uid: 'test_uid_123', email: 'e2e@test.com' };
          return true; // allow access
        },
      })
      .overrideProvider(PrismaService)
      .useValue({ client: mockPrismaClient })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('/api/v1 (GET) - Hello World', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/users/register (POST) - sync user', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue(null);
    const mockUser = {
      id: 'user1',
      firebaseUid: 'test_uid_123',
      email: 'e2e@test.com',
    };
    mockPrismaClient.user.create.mockResolvedValue(mockUser);

    const res = await request(app.getHttpServer())
      .post('/api/v1/users/register')
      .send({ role: 'STUDENT' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockUser);
    expect(mockPrismaClient.user.create).toHaveBeenCalled();
  });

  it('/api/v1/credits/topup (POST) - add mock credits', async () => {
    mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'user1' });
    const mockTxResult = {
      user: { id: 'user1', creditBalance: 100 },
      transaction: { id: 'tx1', amount: 100 },
    };
    mockPrismaClient.$transaction.mockResolvedValue(mockTxResult);

    const res = await request(app.getHttpServer())
      .post('/api/v1/credits/topup')
      .send({ amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockTxResult);
  });
});
