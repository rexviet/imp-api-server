import { AttemptStatus, TransactionType } from '@prisma/client';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedContext = {
  student: {
    id: string;
    firebaseUid: string;
    initialCreditBalance: number;
  };
  teacherOne: {
    id: string;
    firebaseUid: string;
    initialCreditBalance: number;
    profileId: string;
    creditRate: number;
  };
  teacherTwo: {
    id: string;
    firebaseUid: string;
    initialCreditBalance: number;
    profileId: string;
    creditRate: number;
  };
  testId: string;
  attemptId: string;
};

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase('Cross-portal finalization assertions (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let seedContext: SeedContext;

  const mockFirebaseService = {
    verifyToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === 'student-token') {
        return { uid: seedContext.student.firebaseUid };
      }
      if (token === 'teacher1-token') {
        return { uid: seedContext.teacherOne.firebaseUid };
      }
      if (token === 'teacher2-token') {
        return { uid: seedContext.teacherTwo.firebaseUid };
      }
      throw new Error('Invalid token');
    }),
    onModuleInit: jest.fn(),
    getAuth: jest.fn(),
  };

  const mockStorageProvider = {
    getPresignedUrl: jest
      .fn()
      .mockImplementation(
        async (filePath: string) => `https://signed.local/${filePath}`,
      ),
    getPresignedUploadUrl: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const cleanup = async (context: SeedContext | null) => {
    if (!context) return;

    await prismaService.client.gradingRequest.deleteMany({
      where: { attemptId: context.attemptId },
    });

    await prismaService.client.transaction.deleteMany({
      where: {
        userId: {
          in: [
            context.student.id,
            context.teacherOne.id,
            context.teacherTwo.id,
          ],
        },
      },
    });

    await prismaService.client.userAttempt.deleteMany({
      where: { id: context.attemptId },
    });

    await prismaService.client.question.deleteMany({
      where: { section: { testId: context.testId } },
    });

    await prismaService.client.testSection.deleteMany({
      where: { testId: context.testId },
    });

    await prismaService.client.mockTest.deleteMany({
      where: { id: context.testId },
    });

    await prismaService.client.teacherProfile.deleteMany({
      where: {
        id: {
          in: [context.teacherOne.profileId, context.teacherTwo.profileId],
        },
      },
    });

    await prismaService.client.user.deleteMany({
      where: {
        id: {
          in: [
            context.student.id,
            context.teacherOne.id,
            context.teacherTwo.id,
          ],
        },
      },
    });
  };

  const seed = async (): Promise<SeedContext> => {
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const student = await prismaService.client.user.create({
      data: {
        firebaseUid: `cross_portal_student_${suffix}`,
        email: `cross.portal.student.${suffix}@example.com`,
        name: 'Cross Portal Student',
        creditBalance: 200,
      },
    });

    const teacherOne = await prismaService.client.user.create({
      data: {
        firebaseUid: `cross_portal_teacher_1_${suffix}`,
        email: `cross.portal.teacher.one.${suffix}@example.com`,
        name: 'Cross Portal Teacher One',
        role: 'TEACHER',
        creditBalance: 25,
      },
    });

    const teacherTwo = await prismaService.client.user.create({
      data: {
        firebaseUid: `cross_portal_teacher_2_${suffix}`,
        email: `cross.portal.teacher.two.${suffix}@example.com`,
        name: 'Cross Portal Teacher Two',
        role: 'TEACHER',
        creditBalance: 30,
      },
    });

    const teacherOneProfile = await prismaService.client.teacherProfile.create({
      data: {
        userId: teacherOne.id,
        creditRate: 20,
      },
    });

    const teacherTwoProfile = await prismaService.client.teacherProfile.create({
      data: {
        userId: teacherTwo.id,
        creditRate: 35,
      },
    });

    const test = await prismaService.client.mockTest.create({
      data: {
        id: `cross_portal_test_${suffix}`,
        title: 'Cross Portal Review Flow Test',
        sections: {
          create: [
            {
              type: 'WRITING',
              order: 1,
              questions: {
                create: [
                  {
                    order: 1,
                    content: {
                      text: 'Describe the advantages of remote work.',
                    },
                  },
                ],
              },
            },
            {
              type: 'SPEAKING',
              order: 2,
              questions: {
                create: [
                  {
                    order: 1,
                    content: { text: 'Talk about your hometown.' },
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        sections: {
          include: {
            questions: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    const writingSection = test.sections.find(
      (section) => section.type === 'WRITING',
    );
    const speakingSection = test.sections.find(
      (section) => section.type === 'SPEAKING',
    );
    const writingQuestionId = writingSection?.questions[0]?.id;
    const speakingQuestionId = speakingSection?.questions[0]?.id;
    if (!writingQuestionId || !speakingQuestionId) {
      throw new Error('Failed to seed writing/speaking questions for attempt');
    }

    const attempt = await prismaService.client.userAttempt.create({
      data: {
        id: `cross_portal_attempt_${suffix}`,
        userId: student.id,
        testId: test.id,
        status: AttemptStatus.COMPLETED,
        answers: {
          [writingQuestionId]:
            'Remote work provides flexibility, saves commute time, and improves work-life balance.',
          [speakingQuestionId]: {
            type: 'speaking_transcript',
            history: [
              { role: 'assistant', content: 'Please describe your hometown.' },
              { role: 'user', content: 'It is a peaceful coastal city.' },
            ],
          },
        },
        score: 6.5,
        masterAudioPath: `speaking/master/${suffix}.webm`,
      },
    });

    return {
      student: {
        id: student.id,
        firebaseUid: student.firebaseUid,
        initialCreditBalance: student.creditBalance,
      },
      teacherOne: {
        id: teacherOne.id,
        firebaseUid: teacherOne.firebaseUid,
        initialCreditBalance: teacherOne.creditBalance,
        profileId: teacherOneProfile.id,
        creditRate: teacherOneProfile.creditRate,
      },
      teacherTwo: {
        id: teacherTwo.id,
        firebaseUid: teacherTwo.firebaseUid,
        initialCreditBalance: teacherTwo.creditBalance,
        profileId: teacherTwoProfile.id,
        creditRate: teacherTwoProfile.creditRate,
      },
      testId: test.id,
      attemptId: attempt.id,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseService)
      .useValue(mockFirebaseService)
      .overrideProvider('IStorageProvider')
      .useValue(mockStorageProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prismaService = app.get(PrismaService);
  });

  beforeEach(async () => {
    seedContext = await seed();
  });

  afterEach(async () => {
    await cleanup(seedContext ?? null);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('books WRITING/SPEAKING, finalizes via teacher, and exposes final feedback + finalScore to student review', async () => {
    const writingBooking = await request(app.getHttpServer())
      .post(`/api/v1/attempts/${seedContext.attemptId}/book-review`)
      .set('Authorization', 'Bearer student-token')
      .send({
        teacherId: seedContext.teacherOne.profileId,
        targetSectionType: 'WRITING',
      });
    expect(writingBooking.status).toBe(201);
    expect(writingBooking.body.targetSectionType).toBe('WRITING');

    const speakingBooking = await request(app.getHttpServer())
      .post(`/api/v1/attempts/${seedContext.attemptId}/book-review`)
      .set('Authorization', 'Bearer student-token')
      .send({
        teacherId: seedContext.teacherTwo.profileId,
        targetSectionType: 'SPEAKING',
      });
    expect(speakingBooking.status).toBe(201);
    expect(speakingBooking.body.targetSectionType).toBe('SPEAKING');

    const teacherOneQueue = await request(app.getHttpServer())
      .get('/api/v1/teacher/grading-requests')
      .set('Authorization', 'Bearer teacher1-token');
    expect(teacherOneQueue.status).toBe(200);
    expect(teacherOneQueue.body).toHaveLength(1);
    expect(teacherOneQueue.body[0].id).toBe(writingBooking.body.id);
    expect(teacherOneQueue.body[0].targetSectionType).toBe('WRITING');

    const teacherTwoQueue = await request(app.getHttpServer())
      .get('/api/v1/teacher/grading-requests')
      .set('Authorization', 'Bearer teacher2-token');
    expect(teacherTwoQueue.status).toBe(200);
    expect(teacherTwoQueue.body).toHaveLength(1);
    expect(teacherTwoQueue.body[0].id).toBe(speakingBooking.body.id);
    expect(teacherTwoQueue.body[0].targetSectionType).toBe('SPEAKING');

    const speakingDetail = await request(app.getHttpServer())
      .get(`/api/v1/teacher/grading-requests/${speakingBooking.body.id}`)
      .set('Authorization', 'Bearer teacher2-token');
    expect(speakingDetail.status).toBe(200);
    expect(speakingDetail.body.attempt.masterAudioUrl).toContain(
      'https://signed.local/speaking/master/',
    );

    const writingDraft = await request(app.getHttpServer())
      .patch(`/api/v1/teacher/grading-requests/${writingBooking.body.id}/draft`)
      .set('Authorization', 'Bearer teacher1-token')
      .send({
        feedback: 'Writing draft feedback.',
        rubric: { taskResponse: 7, cohesion: 7, lexical: 6.5, grammar: 7 },
      });
    expect(writingDraft.status).toBe(200);
    expect(writingDraft.body.status).toBe('IN_PROGRESS');
    expect(writingDraft.body.finalScore).toBeNull();

    const speakingDraft = await request(app.getHttpServer())
      .patch(
        `/api/v1/teacher/grading-requests/${speakingBooking.body.id}/draft`,
      )
      .set('Authorization', 'Bearer teacher2-token')
      .send({
        feedback: 'Speaking draft feedback.',
        rubric: { fluency: 6.5, lexical: 6.5, grammar: 6, pronunciation: 6.5 },
      });
    expect(speakingDraft.status).toBe(200);
    expect(speakingDraft.body.status).toBe('IN_PROGRESS');
    expect(speakingDraft.body.finalScore).toBeNull();

    const studentReviewBeforeFinalSubmit = await request(app.getHttpServer())
      .get(`/api/v1/attempts/${seedContext.attemptId}`)
      .set('Authorization', 'Bearer student-token');
    expect(studentReviewBeforeFinalSubmit.status).toBe(200);
    expect(studentReviewBeforeFinalSubmit.body.gradingRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: writingBooking.body.id,
          status: 'IN_PROGRESS',
          feedback: 'Writing draft feedback.',
          finalScore: null,
        }),
        expect.objectContaining({
          id: speakingBooking.body.id,
          status: 'IN_PROGRESS',
          feedback: 'Speaking draft feedback.',
          finalScore: null,
        }),
      ]),
    );

    const writingSubmit = await request(app.getHttpServer())
      .post(`/api/v1/teacher/grading-requests/${writingBooking.body.id}/submit`)
      .set('Authorization', 'Bearer teacher1-token')
      .send({
        feedback: 'Final writing review with clear action steps.',
        rubric: { taskResponse: 7, cohesion: 7, lexical: 6.5, grammar: 7 },
        finalScore: 7,
      });
    expect(writingSubmit.status).toBe(201);
    expect(writingSubmit.body.status).toBe('COMPLETED');
    expect(writingSubmit.body.finalScore).toBe(7);

    const speakingSubmit = await request(app.getHttpServer())
      .post(
        `/api/v1/teacher/grading-requests/${speakingBooking.body.id}/submit`,
      )
      .set('Authorization', 'Bearer teacher2-token')
      .send({
        feedback: 'Final speaking review with pronunciation guidance.',
        rubric: { fluency: 6.5, lexical: 6.5, grammar: 6, pronunciation: 6.5 },
        finalScore: 6.5,
      });
    expect(speakingSubmit.status).toBe(201);
    expect(speakingSubmit.body.status).toBe('COMPLETED');
    expect(speakingSubmit.body.finalScore).toBe(6.5);

    const studentReview = await request(app.getHttpServer())
      .get(`/api/v1/attempts/${seedContext.attemptId}`)
      .set('Authorization', 'Bearer student-token');
    expect(studentReview.status).toBe(200);
    expect(studentReview.body.gradingRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: writingBooking.body.id,
          targetSectionType: 'WRITING',
          status: 'COMPLETED',
          feedback: 'Final writing review with clear action steps.',
          finalScore: 7,
        }),
        expect.objectContaining({
          id: speakingBooking.body.id,
          targetSectionType: 'SPEAKING',
          status: 'COMPLETED',
          feedback: 'Final speaking review with pronunciation guidance.',
          finalScore: 6.5,
        }),
      ]),
    );

    const [studentAfter, teacherOneAfter, teacherTwoAfter, transactions] =
      await Promise.all([
        prismaService.client.user.findUnique({
          where: { id: seedContext.student.id },
          select: { creditBalance: true },
        }),
        prismaService.client.user.findUnique({
          where: { id: seedContext.teacherOne.id },
          select: { creditBalance: true },
        }),
        prismaService.client.user.findUnique({
          where: { id: seedContext.teacherTwo.id },
          select: { creditBalance: true },
        }),
        prismaService.client.transaction.findMany({
          where: {
            userId: {
              in: [
                seedContext.student.id,
                seedContext.teacherOne.id,
                seedContext.teacherTwo.id,
              ],
            },
          },
          select: {
            userId: true,
            amount: true,
            type: true,
          },
        }),
      ]);

    expect(studentAfter?.creditBalance).toBe(
      seedContext.student.initialCreditBalance -
        seedContext.teacherOne.creditRate -
        seedContext.teacherTwo.creditRate,
    );
    expect(teacherOneAfter?.creditBalance).toBe(
      seedContext.teacherOne.initialCreditBalance +
        seedContext.teacherOne.creditRate,
    );
    expect(teacherTwoAfter?.creditBalance).toBe(
      seedContext.teacherTwo.initialCreditBalance +
        seedContext.teacherTwo.creditRate,
    );

    expect(
      transactions.filter(
        (entry) =>
          entry.userId === seedContext.student.id &&
          entry.type === TransactionType.SPEND,
      ),
    ).toHaveLength(2);
    expect(
      transactions.filter(
        (entry) =>
          entry.userId === seedContext.teacherOne.id &&
          entry.type === TransactionType.EARN,
      ),
    ).toHaveLength(1);
    expect(
      transactions.filter(
        (entry) =>
          entry.userId === seedContext.teacherTwo.id &&
          entry.type === TransactionType.EARN,
      ),
    ).toHaveLength(1);
  }, 20000);
});
