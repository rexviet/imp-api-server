import { Test, TestingModule } from '@nestjs/testing';
import { SpeakingGateway } from './speaking.gateway';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { SpeakingSessionService } from './speaking-session.service';

describe('SpeakingGateway', () => {
  let gateway: SpeakingGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let mockSpeakingSessionService: Partial<SpeakingSessionService>;

  beforeEach(async () => {
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      user: { uid: 'test-user' },
      handshake: {
        auth: { token: 'valid-token' },
      },
    } as any;

    mockServer = {
      emit: jest.fn(),
    };

    const mockFirebaseService = {
      verifyToken: jest.fn().mockResolvedValue({ uid: 'test-user' }),
    };

    mockSpeakingSessionService = {
      initializeSession: jest.fn().mockResolvedValue('Hello from AI'),
      processTurn: jest.fn().mockResolvedValue({
        transcript: 'I live in London',
        nextQuestion: 'What is the weather like there?',
      }),
      createUploadUrl: jest.fn().mockResolvedValue('http://upload'),
      endSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeakingGateway,
        { provide: FirebaseService, useValue: mockFirebaseService },
        {
          provide: SpeakingSessionService,
          useValue: mockSpeakingSessionService,
        },
      ],
    }).compile();

    gateway = module.get<SpeakingGateway>(SpeakingGateway);
    gateway.server = mockServer as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleJoin', () => {
    it('should join the attempt room and emit examiner-ready via AI session', async () => {
      const data = { attemptId: 'test-attempt-id', questionId: 'q1' };

      await gateway.handleJoin(data, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('test-attempt-id');
      expect(mockSpeakingSessionService.initializeSession).toHaveBeenCalledWith(
        'test-attempt-id',
        'q1',
        undefined,
        'test-user',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('examiner-ready', {
        message: 'Hello from AI',
      });
    });
  });

  describe('handleAudioChunk', () => {
    it('should receive audio chunk and emit examiner-response instantly via AI service', async () => {
      await gateway.handleJoin(
        { attemptId: 'test-attempt-id', questionId: 'q1' },
        mockSocket as Socket,
      );

      const data = { attemptId: 'test-attempt-id', audio: 'base64-data' };

      await gateway.handleAudioChunk(data, mockSocket as Socket);

      expect(mockSpeakingSessionService.processTurn).toHaveBeenCalledWith(
        'test-attempt-id',
        'base64-data',
        'test-user',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('examiner-response', {
        transcript: 'I live in London',
        nextQuestion: 'What is the weather like there?',
      });
    });
  });

  describe('handleEnd', () => {
    it('should delete session state and leave room', async () => {
      const data = { attemptId: 'test-attempt-id' };
      await gateway.handleJoin(
        { attemptId: 'test-attempt-id', questionId: 'q1' },
        mockSocket as Socket,
      );
      await gateway.handleEnd(data, mockSocket as Socket);

      expect(mockSpeakingSessionService.endSession).toHaveBeenCalledWith(
        'test-attempt-id',
        'test-user',
      );
      expect(mockSocket.leave).toHaveBeenCalledWith('test-attempt-id');
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up session if client was joined to an attempt', async () => {
      const data = { attemptId: 'disc-attempt', questionId: 'q1' };

      // First join to set the mapping
      await gateway.handleJoin(data, mockSocket as Socket);

      // Then trigger disconnect
      await gateway.handleDisconnect(mockSocket as Socket);

      expect(mockSpeakingSessionService.endSession).toHaveBeenCalledWith(
        'disc-attempt',
        'test-user',
      );
    });

    it('should not throw if client was not in an attempt', () => {
      expect(() =>
        gateway.handleDisconnect(mockSocket as Socket),
      ).not.toThrow();
    });
  });

  describe('authorization boundaries', () => {
    it('should emit unauthorized error when request-upload-url attempt does not match joined attempt', async () => {
      await gateway.handleJoin(
        { attemptId: 'attempt-a', questionId: 'q1' },
        mockSocket as Socket,
      );

      await gateway.handleRequestUploadUrl(
        { attemptId: 'attempt-b' },
        mockSocket as Socket,
      );

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
    });
  });
});
