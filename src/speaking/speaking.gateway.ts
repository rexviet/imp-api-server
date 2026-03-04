import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { SpeakingSessionService } from './speaking-session.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'speaking',
})
@UseGuards(WsAuthGuard)
export class SpeakingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('SpeakingGateway');

  constructor(private speakingSessionService: SpeakingSessionService) {}

  afterInit(server: Server) {
    this.logger.log('Speaking Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Ideally we would unmap client.id -> attemptId and endSession if abrupt
  }

  @SubscribeMessage('join-speaking-test')
  async handleJoin(@MessageBody() data: { attemptId: string }, @ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} joined attempt: ${data.attemptId}`);
    client.join(data.attemptId);
    
    try {
      // Initialize Gemini Chat context and get opener
      const opener = await this.speakingSessionService.initializeSession(data.attemptId);
      
      client.emit('examiner-ready', {
        message: opener,
      });
    } catch (e) {
      this.logger.error(`Failed to initialize session: ${e.message}`);
      client.emit('error', { message: 'Failed to start AI Examiner session.' });
    }
  }

  @SubscribeMessage('send-audio-chunk')
  async handleAudioChunk(
    @MessageBody() data: { attemptId: string; audio: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Received audio chunk from ${client.id} for attempt ${data.attemptId}`);
      
      if (!data.audio || !data.attemptId) {
        throw new Error('Invalid data payload (missing audio buffer or attemptId)');
      }

      // STT -> LLM Pipeline Turn
      const reply = await this.speakingSessionService.processTurn(data.attemptId, data.audio);
      
      client.emit('examiner-response', {
        transcript: reply.transcript,
        nextQuestion: reply.nextQuestion,
      });
      
    } catch (err) {
      this.logger.error(`Error processing audio turn: ${err.message}`);
      client.emit('error', { message: 'Failed to process audio or generate LLM response' });
    }
  }

  @SubscribeMessage('end-speaking-test')
  handleEnd(@MessageBody() data: { attemptId: string }, @ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} ended attempt ${data.attemptId}`);
    this.speakingSessionService.endSession(data.attemptId);
    client.leave(data.attemptId);
  }
}
