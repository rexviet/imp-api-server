import { Test, TestingModule } from '@nestjs/testing';
import { SpeakingGateway } from './speaking.gateway';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';

describe('SpeakingGateway', () => {
  let gateway: SpeakingGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpeakingGateway,
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    gateway = module.get<SpeakingGateway>(SpeakingGateway);
    gateway.server = mockServer as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleJoin', () => {
    it('should join the attempt room and emit examiner-ready', () => {
      const data = { attemptId: 'test-attempt-id' };
      
      gateway.handleJoin(data, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('test-attempt-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('examiner-ready', {
        message: 'Hello, I am your examiner. Shall we begin the test?',
      });
    });
  });

  describe('handleAudioChunk', () => {
    it('should receive audio chunk and emit examiner-response after delay', (done) => {
      const data = { attemptId: 'test-attempt-id', audio: 'base64-data' };
      
      gateway.handleAudioChunk(data, mockSocket as Socket);

      // Wait for the mock setTimeout (1500ms in code)
      // Since it's a mock delay, we wait slightly longer
      setTimeout(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('examiner-response', expect.objectContaining({
          nextQuestion: expect.any(String),
        }));
        done();
      }, 1600);
    });
  });
});
