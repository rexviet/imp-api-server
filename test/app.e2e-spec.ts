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
import { TEACHER_GRADING_DATASOURCE } from '../src/teacher-grading/teacher-grading.datasource';
import { AttemptStatus } from '@prisma/client';
import { AIGradingService } from '../src/attempts/grading/ai-grading.service';

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
    createGradingRequestWithCreditTransfer: jest.fn(),
  };

  const mockTeacherGradingDatasource = {
    findTeacherProfileByFirebaseUid: jest.fn(),
    findRequestsByTeacher: jest.fn(),
    findRequestDetail: jest.fn(),
    updateRequest: jest.fn(),
  };

  const mockAdminDatasource = {
    createMockTest: jest.fn(),
    findAllMockTests: jest.fn(),
  };

  const mockAIGradingService = {
    gradeWriting: jest.fn(),
    gradeSpeaking: jest.fn(),
  };

  const mockStorageProvider = {
    getPresignedUrl: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
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
          const authHeader = req.headers?.authorization as string | undefined;
          const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

          if (token === 'student-token') {
            req.user = {
              uid: 'student_uid',
              email: 'student@example.com',
              name: 'Student User',
            };
            return true;
          }

          if (token === 'teacher1-token') {
            req.user = {
              uid: 'teacher1_uid',
              email: 'teacher1@example.com',
              name: 'Teacher One',
            };
            return true;
          }

          if (token === 'teacher2-token') {
            req.user = {
              uid: 'teacher2_uid',
              email: 'teacher2@example.com',
              name: 'Teacher Two',
            };
            return true;
          }

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
      .overrideProvider(TEACHER_GRADING_DATASOURCE)
      .useValue(mockTeacherGradingDatasource)
      .overrideProvider(ADMIN_DATASOURCE)
      .useValue(mockAdminDatasource)
      .overrideProvider(AIGradingService)
      .useValue(mockAIGradingService)
      .overrideProvider('IStorageProvider')
      .useValue(mockStorageProvider)
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
        .send({ name: 'Test User' });

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
        .send({ name: 'Test User' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(existingUser);
      expect(mockUsersDatasource.create).not.toHaveBeenCalled();
    });

    it('POST /api/v1/users/register - should reject unsupported elevated role payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({ name: 'Attacker Name', role: 'ADMIN' });

      expect(res.status).toBe(400);
      expect(mockUsersDatasource.create).not.toHaveBeenCalled();
    });

    it('POST /api/v1/users/register - should allow teacher role payload', async () => {
      mockUsersDatasource.findByFirebaseUid.mockResolvedValue(null);
      const mockUser = {
        id: 'teacher-user-1',
        firebaseUid: 'test_uid_123',
        email: 'e2e@test.com',
        name: 'Teacher One',
        role: 'TEACHER',
      };
      mockUsersDatasource.create.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({ name: 'Teacher One', role: 'TEACHER' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockUser);
      expect(mockUsersDatasource.create).toHaveBeenCalledWith({
        firebaseUid: 'test_uid_123',
        email: 'e2e@test.com',
        name: 'Teacher One',
        role: 'TEACHER',
      });
      expect(mockUsersDatasource.createTeacherProfile).toHaveBeenCalledWith(
        'teacher-user-1',
      );
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
  // 6. End-to-End Review Flow
  // ════════════════════════════════════════════════════════════
  describe('End-to-End Student -> AI -> Teacher Review Flow', () => {
    type FlowUser = {
      id: string;
      firebaseUid: string;
      name: string;
      email: string;
      role: 'STUDENT' | 'TEACHER';
      creditBalance: number;
    };

    type FlowTeacherProfile = {
      id: string;
      userId: string;
      creditRate: number;
    };

    type FlowGradingRequest = {
      id: string;
      attemptId: string;
      teacherId: string;
      targetSectionType: 'WRITING' | 'SPEAKING';
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      feedback: string | null;
      rubric: Record<string, unknown> | null;
      finalScore: number | null;
      createdAt: Date;
      updatedAt: Date;
    };

    type FlowState = {
      users: Record<string, FlowUser>;
      teacherProfiles: Record<string, FlowTeacherProfile>;
      attempt: any;
      gradingRequests: FlowGradingRequest[];
      requestCounter: number;
    };

    let flowState: FlowState;

    const createFlowState = (): FlowState => {
      const createdAt = new Date('2026-03-07T09:00:00.000Z');

      return {
        users: {
          student: {
            id: 'u-student',
            firebaseUid: 'student_uid',
            name: 'Student User',
            email: 'student@example.com',
            role: 'STUDENT',
            creditBalance: 180,
          },
          teacherOne: {
            id: 'u-teacher-1',
            firebaseUid: 'teacher1_uid',
            name: 'Teacher One',
            email: 'teacher1@example.com',
            role: 'TEACHER',
            creditBalance: 30,
          },
          teacherTwo: {
            id: 'u-teacher-2',
            firebaseUid: 'teacher2_uid',
            name: 'Teacher Two',
            email: 'teacher2@example.com',
            role: 'TEACHER',
            creditBalance: 45,
          },
        },
        teacherProfiles: {
          'tp-1': {
            id: 'tp-1',
            userId: 'u-teacher-1',
            creditRate: 50,
          },
          'tp-2': {
            id: 'tp-2',
            userId: 'u-teacher-2',
            creditRate: 55,
          },
        },
        attempt: {
          id: 'attempt-flow-1',
          userId: 'u-student',
          status: AttemptStatus.IN_PROGRESS,
          score: null,
          aiGrades: null,
          masterAudioPath: 'speaking/master/attempt-flow-1.webm',
          createdAt,
          answers: {
            'q-writing-1':
              'Studying abroad offers practical benefits, including language immersion and career growth.',
            'q-speaking-1': {
              type: 'speaking_transcript',
              history: [
                { role: 'assistant', content: 'Tell me about your hometown.' },
                { role: 'user', content: 'My hometown is a coastal city.' },
              ],
            },
          },
          test: {
            id: 'test-flow-1',
            title: 'IELTS Mock Full Test',
            sections: [
              {
                id: 'sec-writing',
                type: 'WRITING',
                order: 1,
                questions: [
                  {
                    id: 'q-writing-1',
                    order: 1,
                    content: { text: 'Discuss advantages of studying abroad.' },
                  },
                ],
              },
              {
                id: 'sec-speaking',
                type: 'SPEAKING',
                order: 2,
                questions: [{ id: 'q-speaking-1', order: 1, content: {} }],
              },
            ],
          },
        },
        gradingRequests: [],
        requestCounter: 0,
      };
    };

    const resolveUserByFirebaseUid = (firebaseUid: string) =>
      Object.values(flowState.users).find(
        (candidate) => candidate.firebaseUid === firebaseUid,
      ) ?? null;

    const toTeacherQueueItem = (requestItem: FlowGradingRequest) => {
      const student = flowState.users.student;

      return {
        id: requestItem.id,
        status: requestItem.status,
        feedback: requestItem.feedback,
        finalScore: requestItem.finalScore,
        rubric: requestItem.rubric,
        targetSectionType: requestItem.targetSectionType,
        createdAt: requestItem.createdAt,
        updatedAt: requestItem.updatedAt,
        attempt: {
          id: flowState.attempt.id,
          status: flowState.attempt.status,
          score: flowState.attempt.score,
          createdAt: flowState.attempt.createdAt,
          user: {
            id: student.id,
            name: student.name,
            email: student.email,
          },
          test: {
            id: flowState.attempt.test.id,
            title: flowState.attempt.test.title,
            sections: flowState.attempt.test.sections.map((section: any) => ({
              id: section.id,
              type: section.type,
            })),
          },
        },
      };
    };

    const toTeacherDetail = (requestItem: FlowGradingRequest) => {
      const student = flowState.users.student;
      const teacherProfile = flowState.teacherProfiles[requestItem.teacherId];
      const teacherUser = Object.values(flowState.users).find(
        (candidate) => candidate.id === teacherProfile.userId,
      );

      return {
        id: requestItem.id,
        status: requestItem.status,
        feedback: requestItem.feedback,
        finalScore: requestItem.finalScore,
        rubric: requestItem.rubric,
        targetSectionType: requestItem.targetSectionType,
        teacher: {
          id: teacherProfile.id,
          user: {
            id: teacherUser?.id,
            name: teacherUser?.name,
            email: teacherUser?.email,
          },
        },
        attempt: {
          id: flowState.attempt.id,
          answers: flowState.attempt.answers,
          aiGrades: flowState.attempt.aiGrades,
          score: flowState.attempt.score,
          masterAudioPath: flowState.attempt.masterAudioPath,
          createdAt: flowState.attempt.createdAt,
          user: {
            id: student.id,
            name: student.name,
            email: student.email,
          },
          test: {
            id: flowState.attempt.test.id,
            title: flowState.attempt.test.title,
            sections: flowState.attempt.test.sections.map((section: any) => ({
              id: section.id,
              type: section.type,
              order: section.order,
              questions: section.questions.map((question: any) => ({
                id: question.id,
                order: question.order,
                content: question.content,
              })),
            })),
          },
        },
      };
    };

    beforeEach(() => {
      flowState = createFlowState();

      mockAIGradingService.gradeWriting.mockResolvedValue({
        overallBand: 7.5,
        generalFeedback: 'Task response is clear and well developed.',
      });
      mockAIGradingService.gradeSpeaking.mockResolvedValue({
        overallBand: 6.5,
        generalFeedback: 'Fluency is decent but pronunciation needs polish.',
      });
      mockStorageProvider.getPresignedUrl.mockImplementation(
        async (filePath: string) => `https://signed.local/${filePath}`,
      );

      mockAttemptsDatasource.findUserByFirebaseUid.mockImplementation(
        async (firebaseUid: string) => {
          const user = resolveUserByFirebaseUid(firebaseUid);
          return user
            ? {
                id: user.id,
                firebaseUid: user.firebaseUid,
                name: user.name,
                email: user.email,
                role: user.role,
                creditBalance: user.creditBalance,
              }
            : null;
        },
      );

      mockAttemptsDatasource.findAttemptByIdWithTestAndQuestions.mockImplementation(
        async (attemptId: string) => {
          if (attemptId !== flowState.attempt.id) {
            return null;
          }
          return flowState.attempt;
        },
      );

      mockAttemptsDatasource.updateAttemptGrades.mockImplementation(
        async (
          attemptId: string,
          grades: Record<string, unknown>,
          score: number | null,
          detailedAiFeedback?: Record<string, unknown>,
        ) => {
          if (attemptId !== flowState.attempt.id) {
            throw new Error('ATTEMPT_NOT_FOUND');
          }

          flowState.attempt = {
            ...flowState.attempt,
            status: AttemptStatus.COMPLETED,
            score,
            aiGrades: {
              sections: grades,
              detailed: detailedAiFeedback,
            },
          };

          return flowState.attempt;
        },
      );

      mockAttemptsDatasource.createGradingRequestWithCreditTransfer.mockImplementation(
        async (
          firebaseUid: string,
          attemptId: string,
          teacherProfileId: string,
          targetSectionType: 'WRITING' | 'SPEAKING',
        ) => {
          const student = resolveUserByFirebaseUid(firebaseUid);
          if (!student) {
            throw new Error('User not found in transaction');
          }

          if (
            attemptId !== flowState.attempt.id ||
            flowState.attempt.userId !== student.id
          ) {
            throw new Error('ATTEMPT_NOT_FOUND_OR_FORBIDDEN');
          }
          if (flowState.attempt.status === AttemptStatus.IN_PROGRESS) {
            throw new Error('ATTEMPT_NOT_COMPLETED');
          }

          const teacherProfile = flowState.teacherProfiles[teacherProfileId];
          if (!teacherProfile) {
            throw new Error('TEACHER_NOT_FOUND');
          }

          const existingPendingRequest = flowState.gradingRequests.find(
            (requestItem) =>
              requestItem.attemptId === attemptId &&
              requestItem.teacherId === teacherProfileId &&
              requestItem.status === 'PENDING',
          );
          if (existingPendingRequest) {
            throw new Error('GRADING_REQUEST_EXISTS');
          }

          const cost = teacherProfile.creditRate;
          if (student.creditBalance < cost) {
            throw new Error(
              `INSUFFICIENT_CREDITS:${cost}:${student.creditBalance}`,
            );
          }

          student.creditBalance -= cost;
          const teacher = Object.values(flowState.users).find(
            (candidate) => candidate.id === teacherProfile.userId,
          );
          if (teacher) {
            teacher.creditBalance += cost;
          }

          flowState.requestCounter += 1;
          const now = new Date(
            `2026-03-07T10:0${flowState.requestCounter}:00.000Z`,
          );
          const newRequest: FlowGradingRequest = {
            id: `gr-flow-${flowState.requestCounter}`,
            attemptId,
            teacherId: teacherProfileId,
            targetSectionType,
            status: 'PENDING',
            feedback: null,
            rubric: null,
            finalScore: null,
            createdAt: now,
            updatedAt: now,
          };
          flowState.gradingRequests.push(newRequest);

          return {
            ...newRequest,
            teacher: {
              id: teacherProfile.id,
              user: teacher
                ? {
                    id: teacher.id,
                    name: teacher.name,
                    email: teacher.email,
                  }
                : null,
            },
          };
        },
      );

      mockAttemptsDatasource.findAttemptByIdWithTest.mockImplementation(
        async (attemptId: string) => {
          if (attemptId !== flowState.attempt.id) {
            return null;
          }

          return {
            ...flowState.attempt,
            gradingRequests: flowState.gradingRequests.map((requestItem) => {
              const teacherProfile =
                flowState.teacherProfiles[requestItem.teacherId];
              const teacherUser = Object.values(flowState.users).find(
                (candidate) => candidate.id === teacherProfile.userId,
              );
              return {
                id: requestItem.id,
                status: requestItem.status,
                feedback: requestItem.feedback,
                finalScore: requestItem.finalScore,
                teacher: {
                  id: teacherProfile.id,
                  user: teacherUser
                    ? {
                        name: teacherUser.name,
                        email: teacherUser.email,
                      }
                    : null,
                },
              };
            }),
            test: {
              ...flowState.attempt.test,
              sections: flowState.attempt.test.sections.map((section: any) => ({
                ...section,
                questions: section.questions.map((question: any) => ({
                  ...question,
                  answerKey: question.answerKey,
                })),
              })),
            },
          };
        },
      );

      mockTeacherGradingDatasource.findTeacherProfileByFirebaseUid.mockImplementation(
        async (firebaseUid: string) => {
          const user = resolveUserByFirebaseUid(firebaseUid);
          if (!user || user.role !== 'TEACHER') {
            return null;
          }

          const teacherProfile = Object.values(flowState.teacherProfiles).find(
            (profile) => profile.userId === user.id,
          );
          if (!teacherProfile) {
            return null;
          }

          return {
            id: teacherProfile.id,
            user: { id: user.id, role: 'TEACHER' },
          };
        },
      );

      mockTeacherGradingDatasource.findRequestsByTeacher.mockImplementation(
        async (teacherId: string) =>
          flowState.gradingRequests
            .filter((requestItem) => requestItem.teacherId === teacherId)
            .map((requestItem) => toTeacherQueueItem(requestItem)),
      );

      mockTeacherGradingDatasource.findRequestDetail.mockImplementation(
        async (requestId: string, teacherId: string) => {
          const requestItem = flowState.gradingRequests.find(
            (candidate) =>
              candidate.id === requestId && candidate.teacherId === teacherId,
          );
          if (!requestItem) {
            return null;
          }

          return toTeacherDetail(requestItem);
        },
      );

      mockTeacherGradingDatasource.updateRequest.mockImplementation(
        async (
          requestId: string,
          teacherId: string,
          data: {
            feedback?: string;
            rubric?: Record<string, unknown>;
            finalScore?: number;
            status?: string;
          },
        ) => {
          const requestItem = flowState.gradingRequests.find(
            (candidate) =>
              candidate.id === requestId && candidate.teacherId === teacherId,
          );
          if (!requestItem) {
            throw new Error('REQUEST_NOT_FOUND_OR_FORBIDDEN');
          }

          if (data.feedback !== undefined) {
            requestItem.feedback = data.feedback;
          }
          if (data.rubric !== undefined) {
            requestItem.rubric = data.rubric;
          }
          if (data.finalScore !== undefined) {
            requestItem.finalScore = data.finalScore;
          }
          if (data.status) {
            requestItem.status = data.status as FlowGradingRequest['status'];
          }
          requestItem.updatedAt = new Date(
            requestItem.updatedAt.getTime() + 60_000,
          );

          return {
            id: requestItem.id,
            attemptId: requestItem.attemptId,
            teacherId: requestItem.teacherId,
            targetSectionType: requestItem.targetSectionType,
            status: requestItem.status,
            feedback: requestItem.feedback,
            rubric: requestItem.rubric,
            finalScore: requestItem.finalScore,
            createdAt: requestItem.createdAt,
            updatedAt: requestItem.updatedAt,
          };
        },
      );
    });

    it('executes the full writing + speaking review lifecycle with AI scoring', async () => {
      const submitResponse = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/submit')
        .set('Authorization', 'Bearer student-token');

      expect(submitResponse.status).toBe(201);
      expect(submitResponse.body.status).toBe(AttemptStatus.COMPLETED);
      expect(submitResponse.body.score).toBe(7);

      expect(mockAIGradingService.gradeWriting).toHaveBeenCalled();
      expect(mockAIGradingService.gradeSpeaking).toHaveBeenCalled();

      const writingBooking = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'WRITING' });

      expect(writingBooking.status).toBe(201);
      expect(writingBooking.body.targetSectionType).toBe('WRITING');

      const speakingBooking = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-2', targetSectionType: 'SPEAKING' });

      expect(speakingBooking.status).toBe(201);
      expect(speakingBooking.body.targetSectionType).toBe('SPEAKING');

      const teacherOneQueue = await request(app.getHttpServer())
        .get('/api/v1/teacher/grading-requests')
        .set('Authorization', 'Bearer teacher1-token');
      expect(teacherOneQueue.status).toBe(200);
      expect(teacherOneQueue.body).toHaveLength(1);
      expect(teacherOneQueue.body[0].targetSectionType).toBe('WRITING');

      const teacherTwoQueue = await request(app.getHttpServer())
        .get('/api/v1/teacher/grading-requests')
        .set('Authorization', 'Bearer teacher2-token');
      expect(teacherTwoQueue.status).toBe(200);
      expect(teacherTwoQueue.body).toHaveLength(1);
      expect(teacherTwoQueue.body[0].targetSectionType).toBe('SPEAKING');

      const detailTeacherOne = await request(app.getHttpServer())
        .get(`/api/v1/teacher/grading-requests/${writingBooking.body.id}`)
        .set('Authorization', 'Bearer teacher1-token');
      expect(detailTeacherOne.status).toBe(200);
      expect(detailTeacherOne.body.attempt.masterAudioUrl).toContain(
        'signed.local/speaking/master/attempt-flow-1.webm',
      );

      const detailTeacherTwo = await request(app.getHttpServer())
        .get(`/api/v1/teacher/grading-requests/${speakingBooking.body.id}`)
        .set('Authorization', 'Bearer teacher2-token');
      expect(detailTeacherTwo.status).toBe(200);
      expect(detailTeacherTwo.body.targetSectionType).toBe('SPEAKING');

      const draftTeacherOne = await request(app.getHttpServer())
        .patch(
          `/api/v1/teacher/grading-requests/${writingBooking.body.id}/draft`,
        )
        .set('Authorization', 'Bearer teacher1-token')
        .send({
          feedback: 'Writing draft feedback.',
          rubric: { task: 7.5, cohesion: 7, lexical: 7, grammar: 7.5 },
        });
      expect(draftTeacherOne.status).toBe(200);
      expect(draftTeacherOne.body.status).toBe('IN_PROGRESS');

      const draftTeacherTwo = await request(app.getHttpServer())
        .patch(
          `/api/v1/teacher/grading-requests/${speakingBooking.body.id}/draft`,
        )
        .set('Authorization', 'Bearer teacher2-token')
        .send({
          feedback: 'Speaking draft feedback.',
          rubric: {
            fluency: 6.5,
            lexical: 6.5,
            grammar: 6.5,
            pronunciation: 6,
          },
        });
      expect(draftTeacherTwo.status).toBe(200);
      expect(draftTeacherTwo.body.status).toBe('IN_PROGRESS');

      const submitTeacherOne = await request(app.getHttpServer())
        .post(
          `/api/v1/teacher/grading-requests/${writingBooking.body.id}/submit`,
        )
        .set('Authorization', 'Bearer teacher1-token')
        .send({
          feedback: 'Final writing review with actionable improvements.',
          rubric: { task: 7.5, cohesion: 7, lexical: 7, grammar: 7.5 },
          finalScore: 7.5,
        });
      expect(submitTeacherOne.status).toBe(201);
      expect(submitTeacherOne.body.status).toBe('COMPLETED');
      expect(submitTeacherOne.body.finalScore).toBe(7.5);

      const submitTeacherTwo = await request(app.getHttpServer())
        .post(
          `/api/v1/teacher/grading-requests/${speakingBooking.body.id}/submit`,
        )
        .set('Authorization', 'Bearer teacher2-token')
        .send({
          feedback: 'Final speaking feedback and pronunciation tips.',
          rubric: {
            fluency: 6.5,
            lexical: 6.5,
            grammar: 6.5,
            pronunciation: 6,
          },
          finalScore: 6.5,
        });
      expect(submitTeacherTwo.status).toBe(201);
      expect(submitTeacherTwo.body.status).toBe('COMPLETED');
      expect(submitTeacherTwo.body.finalScore).toBe(6.5);

      const studentReview = await request(app.getHttpServer())
        .get('/api/v1/attempts/attempt-flow-1')
        .set('Authorization', 'Bearer student-token');

      expect(studentReview.status).toBe(200);
      expect(studentReview.body.gradingRequests).toHaveLength(2);
      expect(studentReview.body.gradingRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'COMPLETED',
            finalScore: 7.5,
            feedback: 'Final writing review with actionable improvements.',
          }),
          expect.objectContaining({
            status: 'COMPLETED',
            finalScore: 6.5,
            feedback: 'Final speaking feedback and pronunciation tips.',
          }),
        ]),
      );
    });

    it('rejects invalid review type when booking teacher review', async () => {
      flowState.attempt.status = AttemptStatus.COMPLETED;

      const response = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'READING' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'targetSectionType must be one of the following values: WRITING, SPEAKING',
        ]),
      );
    });

    it('blocks duplicate pending request for same teacher and attempt', async () => {
      flowState.attempt.status = AttemptStatus.COMPLETED;

      const firstBooking = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'WRITING' });
      expect(firstBooking.status).toBe(201);

      const duplicateBooking = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'SPEAKING' });

      expect(duplicateBooking.status).toBe(400);
      expect(duplicateBooking.body.message).toContain(
        'You already have a pending review request for this teacher',
      );
    });

    it('returns insufficient credit error when student cannot pay review cost', async () => {
      flowState.attempt.status = AttemptStatus.COMPLETED;
      flowState.users.student.creditBalance = 20;

      const response = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'WRITING' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Insufficient credits');
    });

    it('prevents teacher from reading or updating another teacher request', async () => {
      flowState.attempt.status = AttemptStatus.COMPLETED;

      const booking = await request(app.getHttpServer())
        .post('/api/v1/attempts/attempt-flow-1/book-review')
        .set('Authorization', 'Bearer student-token')
        .send({ teacherId: 'tp-1', targetSectionType: 'WRITING' });
      expect(booking.status).toBe(201);

      const unauthorizedDetail = await request(app.getHttpServer())
        .get(`/api/v1/teacher/grading-requests/${booking.body.id}`)
        .set('Authorization', 'Bearer teacher2-token');
      expect(unauthorizedDetail.status).toBe(404);

      const unauthorizedDraft = await request(app.getHttpServer())
        .patch(`/api/v1/teacher/grading-requests/${booking.body.id}/draft`)
        .set('Authorization', 'Bearer teacher2-token')
        .send({
          feedback: 'Should not be allowed',
          rubric: { task: 7 },
        });
      expect(unauthorizedDraft.status).toBe(404);
    });
  });

  // ════════════════════════════════════════════════════════════
  // 7. AdminController
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
