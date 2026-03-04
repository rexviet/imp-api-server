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
      handshake: {
        auth: { token: 'valid-token' }
      }
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
      endSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeakingGateway,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: SpeakingSessionService, useValue: mockSpeakingSessionService },
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
      const data = { attemptId: 'test-attempt-id' };
      
      await gateway.handleJoin(data, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('test-attempt-id');
      expect(mockSpeakingSessionService.initializeSession).toHaveBeenCalledWith('test-attempt-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('examiner-ready', {
        message: 'Hello from AI',
      });
    });
  });

  describe('handleAudioChunk', () => {
    it('should receive audio chunk and emit examiner-response instantly via AI service', async () => {
      const data = { attemptId: 'test-attempt-id', audio: 'base64-data' };
      
      await gateway.handleAudioChunk(data, mockSocket as Socket);

      expect(mockSpeakingSessionService.processTurn).toHaveBeenCalledWith('test-attempt-id', 'base64-data');
      expect(mockSocket.emit).toHaveBeenCalledWith('examiner-response', {
        transcript: 'I live in London',
        nextQuestion: 'What is the weather like there?',
      });
    });
  });

  describe('handleEnd', () => {
    it('should delete session state and leave room', () => {
      const data = { attemptId: 'test-attempt-id' };
      gateway.handleEnd(data, mockSocket as Socket);

      expect(mockSpeakingSessionService.endSession).toHaveBeenCalledWith('test-attempt-id');
      expect(mockSocket.leave).toHaveBeenCalledWith('test-attempt-id');
    });
  });
});
