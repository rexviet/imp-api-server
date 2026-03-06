import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseAuthGuard } from '../src/auth/auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { USERS_DATASOURCE } from '../src/users/users.datasource';
import { CREDITS_DATASOURCE } from '../src/credits/credits.datasource';
import { MOCK_TESTS_DATASOURCE } from '../src/mock-tests/mock-tests.datasource';
import { ATTEMPTS_DATASOURCE } from '../src/attempts/attempts.datasource';
import { ADMIN_DATASOURCE } from '../src/admin/admin.datasource';
import { AttemptStatus } from '@prisma/client';

describe('API Endpoints (e2e)', () => {
  let app: INestApplication;

  // ── Datasource Mocks ─────────────────────────────────────
  const mockUsersDatasource = {
    findByFirebaseUid: jest.fn(),
    findByFirebaseUidWithProfile: jest.fn(),
    create: jest.fn(),
    createTeacherProfile: jest.fn(),
  };

  const mockCreditsDatasource = {
    findUserByFirebaseUid: jest.fn(),
    topUpCreditsTransaction: jest.fn(),
    findTransactionsByUserId: jest.fn(),
  };

  const mockMockTestsDatasource = {
    findAll: jest.fn(),
    findByIdForStudent: jest.fn(),
  };

  const mockAttemptsDatasource = {
    findUserByFirebaseUid: jest.fn(),
    findMockTestById: jest.fn(),
    createAttemptWithCreditDeduction: jest.fn(),
    findAttemptByIdWithTest: jest.fn(),
    findAttemptById: jest.fn(),
    findAttemptByIdWithTestAndQuestions: jest.fn(),
    updateAttemptAnswers: jest.fn(),
    updateAttemptGrades: jest.fn(),
    findAllByUser: jest.fn(),
  };

  const mockAdminDatasource = {
    createMockTest: jest.fn(),
    findAllMockTests: jest.fn(),
  };

  // ── Setup ────────────────────────────────────────────────
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override guards to bypass Firebase auth
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            uid: 'test_uid_123',
            email: 'e2e@test.com',
            name: 'Test User',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      // Override infrastructure services (Firebase + Prisma) to avoid real connections in CI
      .overrideProvider(FirebaseService)
      .useValue({
        onModuleInit: jest.fn(),
        verifyToken: jest.fn(),
        getAuth: jest.fn(),
      })
      .overrideProvider(PrismaService)
      .useValue({
        client: {},
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      // Override all datasources
      .overrideProvider(USERS_DATASOURCE)
      .useValue(mockUsersDatasource)
      .overrideProvider(CREDITS_DATASOURCE)
      .useValue(mockCreditsDatasource)
      .overrideProvider(MOCK_TESTS_DATASOURCE)
      .useValue(mockMockTestsDatasource)
      .overrideProvider(ATTEMPTS_DATASOURCE)
      .useValue(mockAttemptsDatasource)
      .overrideProvider(ADMIN_DATASOURCE)
      .useValue(mockAdminDatasource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════
  // 1. AppController
  // ════════════════════════════════════════════════════════════
  describe('AppController', () => {
    it('GET /api/v1 - should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/api/v1')
        .expect(200)
        .expect('Hello World!');
    });
  });

  // ════════════════════════════════════════════════════════════
  // 2. UsersController
  // ════════════════════════════════════════════════════════════
  describe('UsersController', () => {
    it('POST /api/v1/users/register - should register a new user', async () => {
      mockUsersDatasource.findByFirebaseUid.mockResolvedValue(null);
      const mockUser = {
        id: 'user1',
        firebaseUid: 'test_uid_123',
        email: 'e2e@test.com',
        name: 'Test User',
        role: 'STUDENT',
      };
      mockUsersDatasource.create.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({ role: 'STUDENT' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockUser);
      expect(mockUsersDatasource.create).toHaveBeenCalled();
    });

    it('POST /api/v1/users/register - should return existing user', async () => {
      const existingUser = {
        id: 'user1',
        firebaseUid: 'test_uid_123',
        email: 'e2e@test.com',
        role: 'STUDENT',
      };
      mockUsersDatasource.findByFirebaseUid.mockResolvedValue(existingUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({ role: 'STUDENT' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(existingUser);
      expect(mockUsersDatasource.create).not.toHaveBeenCalled();
    });

    it('GET /api/v1/users/me - should return current user profile', async () => {
      const mockUser = {
        id: 'user1',
        firebaseUid: 'test_uid_123',
        email: 'e2e@test.com',
        teacherProfile: null,
      };
      mockUsersDatasource.findByFirebaseUidWithProfile.mockResolvedValue(
        mockUser,
      );

      const res = await request(app.getHttpServer()).get('/api/v1/users/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUser);
      expect(
        mockUsersDatasource.findByFirebaseUidWithProfile,
      ).toHaveBeenCalledWith('test_uid_123');
    });
  });

  // ════════════════════════════════════════════════════════════
  // 3. CreditsController
  // ════════════════════════════════════════════════════════════
  describe('CreditsController', () => {
    it('POST /api/v1/credits/topup - should top up credits', async () => {
      const mockUser = { id: 'user1', creditBalance: 0 };
      const mockResult = {
        user: { id: 'user1', creditBalance: 100 },
        transaction: { id: 'tx1', amount: 100 },
      };
      mockCreditsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockCreditsDatasource.topUpCreditsTransaction.mockResolvedValue(
        mockResult,
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/credits/topup')
        .send({ amount: 100 });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockResult);
    });

    it('POST /api/v1/credits/topup - should return 404 if user not found', async () => {
      mockCreditsDatasource.findUserByFirebaseUid.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/credits/topup')
        .send({ amount: 100 });

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/credits/transactions - should return transaction history', async () => {
      const mockUser = { id: 'user1' };
      const mockTxns = [
        { id: 'tx1', amount: 100, type: 'TOPUP' },
        { id: 'tx2', amount: -10, type: 'SPEND' },
      ];
      mockCreditsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockCreditsDatasource.findTransactionsByUserId.mockResolvedValue(
        mockTxns,
      );

      const res = await request(app.getHttpServer()).get(
        '/api/v1/credits/transactions',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTxns);
      expect(
        mockCreditsDatasource.findTransactionsByUserId,
      ).toHaveBeenCalledWith('user1', 50);
    });

    it('GET /api/v1/credits/transactions - should return 404 if user not found', async () => {
      mockCreditsDatasource.findUserByFirebaseUid.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/credits/transactions',
      );

      expect(res.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 4. MockTestsController
  // ════════════════════════════════════════════════════════════
  describe('MockTestsController', () => {
    it('GET /api/v1/mock-tests - should return list of mock tests', async () => {
      const mockTests = [
        { id: 't1', title: 'IELTS Academic', _count: { sections: 4 } },
        { id: 't2', title: 'IELTS General', _count: { sections: 2 } },
      ];
      mockMockTestsDatasource.findAll.mockResolvedValue(mockTests);

      const res = await request(app.getHttpServer()).get('/api/v1/mock-tests');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTests);
    });

    it('GET /api/v1/mock-tests/:id - should return a specific mock test', async () => {
      const mockTest = {
        id: 't1',
        title: 'IELTS Academic',
        sections: [
          {
            id: 's1',
            type: 'READING',
            questions: [{ id: 'q1', content: { text: 'Read this' } }],
          },
        ],
      };
      mockMockTestsDatasource.findByIdForStudent.mockResolvedValue(mockTest);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/mock-tests/t1',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTest);
    });

    it('GET /api/v1/mock-tests/:id - should return 404 for non-existent test', async () => {
      mockMockTestsDatasource.findByIdForStudent.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/mock-tests/nonexistent',
      );

      expect(res.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 5. AttemptsController
  // ════════════════════════════════════════════════════════════
  describe('AttemptsController', () => {
    it('POST /api/v1/attempts - should create a new attempt', async () => {
      const mockTest = { id: 't1', title: 'Test' };
      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        testId: 't1',
        status: AttemptStatus.IN_PROGRESS,
      };

      mockAttemptsDatasource.findMockTestById.mockResolvedValue(mockTest);
      mockAttemptsDatasource.createAttemptWithCreditDeduction.mockResolvedValue(
        mockAttempt,
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/attempts')
        .send({ testId: 't1' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockAttempt);
    });

    it('POST /api/v1/attempts - should return 404 if test not found', async () => {
      mockAttemptsDatasource.findMockTestById.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/attempts')
        .send({ testId: 'bad-id' });

      expect(res.status).toBe(404);
    });

    it('POST /api/v1/attempts - should return 400 if insufficient credits', async () => {
      mockAttemptsDatasource.findMockTestById.mockResolvedValue({
        id: 't1',
        title: 'Test',
      });
      mockAttemptsDatasource.createAttemptWithCreditDeduction.mockRejectedValue(
        new Error('INSUFFICIENT_CREDITS:10:5'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/attempts')
        .send({ testId: 't1' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient credits');
    });

    it('GET /api/v1/attempts - should return list of user attempts', async () => {
      const mockUser = { id: 'u1' };
      const mockAttempts = [
        { id: 'a1', testTitle: 'Test 1', overallScore: 7.0 },
      ];

      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockAttemptsDatasource.findAllByUser.mockResolvedValue(mockAttempts);

      const res = await request(app.getHttpServer()).get('/api/v1/attempts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttempts);
      expect(mockAttemptsDatasource.findAllByUser).toHaveBeenCalledWith('u1');
    });

    it('GET /api/v1/attempts/:id - should return an attempt with test data', async () => {
      const mockUser = { id: 'u1' };
      const mockAttempt = {
        id: 'a1',
        userId: 'u1',
        test: { title: 'Test', sections: [] },
      };

      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockAttemptsDatasource.findAttemptByIdWithTest.mockResolvedValue(
        mockAttempt,
      );

      const res = await request(app.getHttpServer()).get('/api/v1/attempts/a1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAttempt);
    });

    it('GET /api/v1/attempts/:id - should return 404 if attempt not found', async () => {
      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue({
        id: 'u1',
      });
      mockAttemptsDatasource.findAttemptByIdWithTest.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/attempts/nonexistent',
      );

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/attempts/:id - should return 403 if attempt belongs to another user', async () => {
      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue({
        id: 'u1',
      });
      mockAttemptsDatasource.findAttemptByIdWithTest.mockResolvedValue({
        id: 'a1',
        userId: 'u999',
      });

      const res = await request(app.getHttpServer()).get('/api/v1/attempts/a1');

      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/attempts/:id - should update answers', async () => {
      const mockUser = { id: 'u1' };
      const attempt = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
      };
      const updated = { id: 'a1', answers: { q1: 'A', q2: 'B' } };

      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockAttemptsDatasource.findAttemptById.mockResolvedValue(attempt);
      mockAttemptsDatasource.updateAttemptAnswers.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/attempts/a1')
        .send({ answers: { q1: 'A', q2: 'B' } });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
    });

    it('PATCH /api/v1/attempts/:id - should return 400 if attempt already completed', async () => {
      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue({
        id: 'u1',
      });
      mockAttemptsDatasource.findAttemptById.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.COMPLETED,
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/attempts/a1')
        .send({ answers: { q1: 'A' } });

      expect(res.status).toBe(400);
    });

    it('POST /api/v1/attempts/:id/submit - should submit and grade attempt', async () => {
      const mockUser = { id: 'u1' };
      const attemptWithTest = {
        id: 'a1',
        userId: 'u1',
        status: AttemptStatus.IN_PROGRESS,
        answers: { q1: 'A' },
        test: {
          sections: [
            {
              id: 's1',
              type: 'READING',
              questions: [{ id: 'q1', answerKey: { value: 'A' } }],
            },
          ],
        },
      };
      const submitted = {
        id: 'a1',
        status: AttemptStatus.COMPLETED,
        score: 4,
      };

      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue(mockUser);
      mockAttemptsDatasource.findAttemptByIdWithTestAndQuestions.mockResolvedValue(
        attemptWithTest,
      );
      mockAttemptsDatasource.updateAttemptGrades.mockResolvedValue(submitted);

      const res = await request(app.getHttpServer()).post(
        '/api/v1/attempts/a1/submit',
      );

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(AttemptStatus.COMPLETED);
    });

    it('POST /api/v1/attempts/:id/submit - should return 400 if already submitted', async () => {
      mockAttemptsDatasource.findUserByFirebaseUid.mockResolvedValue({
        id: 'u1',
      });
      mockAttemptsDatasource.findAttemptByIdWithTestAndQuestions.mockResolvedValue(
        {
          id: 'a1',
          userId: 'u1',
          status: AttemptStatus.COMPLETED,
        },
      );

      const res = await request(app.getHttpServer()).post(
        '/api/v1/attempts/a1/submit',
      );

      expect(res.status).toBe(400);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 6. AdminController
  // ════════════════════════════════════════════════════════════
  describe('AdminController', () => {
    it('POST /api/v1/admin/seed - should seed a mock test', async () => {
      const mockData = {
        title: 'IELTS Academic Full',
        difficulty: 'ACADEMIC',
        sections: [
          {
            type: 'READING',
            order: 1,
            questions: [{ order: 1, content: { text: 'Read the passage' } }],
          },
        ],
      };
      const mockResult = { id: 'test-1', ...mockData };
      mockAdminDatasource.createMockTest.mockResolvedValue(mockResult);

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/seed')
        .send(mockData);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockResult);
      expect(mockAdminDatasource.createMockTest).toHaveBeenCalled();
    });

    it('GET /api/v1/admin/mock-tests - should list all mock tests (admin)', async () => {
      const mockTests = [
        { id: 't1', title: 'Test 1', sections: [] },
        { id: 't2', title: 'Test 2', sections: [] },
      ];
      mockAdminDatasource.findAllMockTests.mockResolvedValue(mockTests);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/admin/mock-tests',
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });
});
