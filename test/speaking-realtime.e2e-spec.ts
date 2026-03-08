import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { Socket, io } from 'socket.io-client';
import { AIService } from '../src/ai/ai.service';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SttService } from '../src/speaking/stt.service';

type AttemptState = {
  id: string;
  ownerFirebaseUid: string;
  answers: Record<string, unknown>;
  masterAudioBucket: string | null;
  masterAudioPath: string | null;
};

const waitForSocketEvent = <T>(
  socket: Socket,
  eventName: string,
  timeoutMs = 5000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs = 5000,
  intervalMs = 50,
): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for condition');
};

describe('Speaking Realtime Flow (e2e)', () => {
  let app: INestApplication;
  let socket: Socket;
  let baseUrl: string;

  const attemptsById: Record<string, AttemptState> = {
    attempt_ws_1: {
      id: 'attempt_ws_1',
      ownerFirebaseUid: 'student_ws_uid',
      answers: {},
      masterAudioBucket: null,
      masterAudioPath: null,
    },
    attempt_ws_other: {
      id: 'attempt_ws_other',
      ownerFirebaseUid: 'other_student_uid',
      answers: {},
      masterAudioBucket: null,
      masterAudioPath: null,
    },
  };

  const mockFirebaseService = {
    verifyToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === 'ws-valid-token') {
        return { uid: 'student_ws_uid', email: 'student.ws@example.com' };
      }
      if (token === 'ws-other-valid-token') {
        return { uid: 'other_student_uid', email: 'other.ws@example.com' };
      }
      throw new Error('Invalid token');
    }),
    onModuleInit: jest.fn(),
    getAuth: jest.fn(),
  };

  const mockPrismaService = {
    client: {
      userAttempt: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const attempt = attemptsById[where.id];
          if (!attempt) {
            return null;
          }

          if (
            where.user?.firebaseUid &&
            attempt.ownerFirebaseUid !== where.user.firebaseUid
          ) {
            return null;
          }

          return { id: attempt.id };
        }),
        findUnique: jest.fn().mockImplementation(async ({ where, select }) => {
          const attempt = attemptsById[where.id];
          if (!attempt) {
            return null;
          }

          if (select) {
            return {
              masterAudioBucket: attempt.masterAudioBucket,
              masterAudioPath: attempt.masterAudioPath,
            };
          }

          return {
            id: attempt.id,
            answers: attempt.answers,
            masterAudioBucket: attempt.masterAudioBucket,
            masterAudioPath: attempt.masterAudioPath,
          };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const attempt = attemptsById[where.id];
          if (!attempt) {
            throw new Error('Attempt not found');
          }

          if (data.answers !== undefined) {
            attempt.answers = data.answers as Record<string, unknown>;
          }
          if (data.masterAudioBucket !== undefined) {
            attempt.masterAudioBucket = data.masterAudioBucket as string;
          }
          if (data.masterAudioPath !== undefined) {
            attempt.masterAudioPath = data.masterAudioPath as string;
          }

          return {
            id: attempt.id,
            answers: attempt.answers,
            masterAudioBucket: attempt.masterAudioBucket,
            masterAudioPath: attempt.masterAudioPath,
          };
        }),
      },
    },
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockAIService = {
    generateResponse: jest
      .fn()
      .mockResolvedValueOnce('Good morning. Could you tell me your full name?')
      .mockResolvedValueOnce('Where are you from?'),
  };

  const mockSttService = {
    transcribeAudio: jest
      .fn()
      .mockResolvedValue('My full name is John Nguyen.'),
  };

  const mockStorageProvider = {
    getPresignedUploadUrl: jest
      .fn()
      .mockResolvedValue(
        'https://upload.local/speaking/master-records/attempt_ws_1.webm',
      ),
    getPresignedUrl: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseService)
      .useValue(mockFirebaseService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(AIService)
      .useValue(mockAIService)
      .overrideProvider(SttService)
      .useValue(mockSttService)
      .overrideProvider('IStorageProvider')
      .useValue(mockStorageProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    attemptsById.attempt_ws_1.answers = {};
    attemptsById.attempt_ws_1.masterAudioBucket = null;
    attemptsById.attempt_ws_1.masterAudioPath = null;

    attemptsById.attempt_ws_other.answers = {};
    attemptsById.attempt_ws_other.masterAudioBucket = null;
    attemptsById.attempt_ws_other.masterAudioPath = null;

    jest.clearAllMocks();
    mockAIService.generateResponse
      .mockResolvedValueOnce('Good morning. Could you tell me your full name?')
      .mockResolvedValueOnce('Where are you from?');
    mockSttService.transcribeAudio.mockResolvedValue(
      'My full name is John Nguyen.',
    );
    mockStorageProvider.getPresignedUploadUrl.mockResolvedValue(
      'https://upload.local/speaking/master-records/attempt_ws_1.webm',
    );
  });

  afterEach(async () => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    if (socket?.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  it('covers join -> send-audio-chunk -> examiner-response -> finalize and master audio persistence', async () => {
    const errors: string[] = [];

    socket = io(`${baseUrl}/speaking`, {
      transports: ['websocket'],
      auth: { token: 'ws-valid-token' },
      reconnection: false,
      forceNew: true,
    });

    socket.on('error', (payload: { message?: string }) => {
      errors.push(payload?.message ?? 'unknown-error');
    });

    await waitForSocketEvent(socket, 'connect');

    socket.emit('join-speaking-test', {
      attemptId: attemptsById.attempt_ws_1.id,
      questionId: 'q-speaking-1',
      questionContext: 'Part 1 introduction',
    });

    const ready = await waitForSocketEvent<{ message: string }>(
      socket,
      'examiner-ready',
    );
    expect(ready.message).toContain('Good morning');

    socket.emit('send-audio-chunk', {
      attemptId: attemptsById.attempt_ws_1.id,
      audio: 'data:audio/webm;base64,dGVzdA==',
    });

    const aiResponse = await waitForSocketEvent<{
      transcript: string;
      nextQuestion: string;
    }>(socket, 'examiner-response');

    expect(aiResponse).toEqual({
      transcript: 'My full name is John Nguyen.',
      nextQuestion: 'Where are you from?',
    });

    socket.emit('request-upload-url', {
      attemptId: attemptsById.attempt_ws_1.id,
    });

    const uploadPayload = await waitForSocketEvent<{ uploadUrl: string }>(
      socket,
      'upload-url-ready',
    );

    expect(uploadPayload.uploadUrl).toBe(
      'https://upload.local/speaking/master-records/attempt_ws_1.webm',
    );

    await waitForCondition(
      () =>
        attemptsById.attempt_ws_1.masterAudioPath ===
        'speaking/master-records/attempt_ws_1.webm',
    );

    socket.emit('end-speaking-test', {
      attemptId: attemptsById.attempt_ws_1.id,
    });

    await waitForCondition(
      () =>
        Boolean(
          (
            attemptsById.attempt_ws_1.answers['q-speaking-1'] as {
              history?: unknown[];
            }
          )?.history,
        ),
      5000,
    );

    expect(attemptsById.attempt_ws_1.masterAudioBucket).toBe(
      'ielts-master-records',
    );
    expect(attemptsById.attempt_ws_1.masterAudioPath).toBe(
      'speaking/master-records/attempt_ws_1.webm',
    );

    const persistedTranscript = attemptsById.attempt_ws_1.answers[
      'q-speaking-1'
    ] as {
      type: string;
      history: Array<{ role: string; content: string }>;
    };

    expect(persistedTranscript.type).toBe('speaking_transcript');
    expect(
      persistedTranscript.history.some(
        (entry) =>
          entry.role === 'user' &&
          entry.content === 'My full name is John Nguyen.',
      ),
    ).toBe(true);
    expect(
      persistedTranscript.history.some(
        (entry) =>
          entry.role === 'model' && entry.content === 'Where are you from?',
      ),
    ).toBe(true);

    expect(errors).toEqual([]);
    expect(mockSttService.transcribeAudio).toHaveBeenCalled();
    expect(mockStorageProvider.getPresignedUploadUrl).toHaveBeenCalledWith(
      'speaking/master-records/attempt_ws_1.webm',
    );
  }, 20000);

  it('rejects websocket connection when auth token is invalid', async () => {
    const unauthSocket = io(`${baseUrl}/speaking`, {
      transports: ['websocket'],
      auth: { token: 'invalid-token' },
      reconnection: false,
      forceNew: true,
    });

    unauthSocket.emit('join-speaking-test', {
      attemptId: attemptsById.attempt_ws_1.id,
      questionId: 'q-speaking-1',
      questionContext: 'Part 1 introduction',
    });

    const authFailure = await new Promise<string>((resolve) => {
      let settled = false;
      const finish = (value: string) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      unauthSocket.once('connect_error', (err: { message?: string }) =>
        finish(`connect_error:${err?.message ?? 'unknown'}`),
      );
      unauthSocket.once('error', (payload: { message?: string }) =>
        finish(`error:${payload?.message ?? 'unknown'}`),
      );
      unauthSocket.once('exception', (payload: { message?: string }) =>
        finish(`exception:${payload?.message ?? 'unknown'}`),
      );
      unauthSocket.once('disconnect', (reason: string) =>
        finish(`disconnect:${reason}`),
      );
      setTimeout(() => finish('timeout'), 6000);
    });

    expect(authFailure).not.toBe('timeout');
    expect(authFailure.toLowerCase()).toContain('unauthor');

    unauthSocket.disconnect();
  }, 10000);

  it('rejects speaking session start when user attempts to access another user attempt', async () => {
    const errors: string[] = [];

    socket = io(`${baseUrl}/speaking`, {
      transports: ['websocket'],
      auth: { token: 'ws-valid-token' },
      reconnection: false,
      forceNew: true,
    });

    socket.on('error', (payload: { message?: string }) => {
      errors.push(payload?.message ?? 'unknown-error');
    });

    await waitForSocketEvent(socket, 'connect');

    socket.emit('join-speaking-test', {
      attemptId: attemptsById.attempt_ws_other.id,
      questionId: 'q-speaking-1',
      questionContext: 'Part 1 introduction',
    });

    await waitForCondition(() => errors.includes('Unauthorized'), 5000);

    expect(errors).toContain('Unauthorized');
  });
});
