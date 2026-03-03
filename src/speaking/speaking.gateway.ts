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
import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import { WsAuthGuard } from '../auth/ws-auth.guard';

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

  afterInit(server: Server) {
    this.logger.log('Speaking Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-speaking-test')
  handleJoin(@MessageBody() data: { attemptId: string }, @ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} joined attempt: ${data.attemptId}`);
    client.join(data.attemptId);
    
    // Send initial welcome
    client.emit('examiner-ready', {
      message: 'Hello, I am your examiner. Shall we begin the test?',
    });
  }

  @SubscribeMessage('send-audio-chunk')
  async handleAudioChunk(
    @MessageBody() data: { attemptId: string; audio: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Received audio chunk from ${client.id} for attempt ${data.attemptId}`);
      
      if (!data.audio || !data.attemptId) {
        throw new Error('Invalid data payload');
      }

      // MOCK: Simulate STT + LLM Delay
      setTimeout(() => {
        client.emit('examiner-response', {
          transcript: "I see, that's interesting.",
          nextQuestion: "Can you tell me more about your hometown?",
          part: 1,
        });
      }, 1500);
    } catch (err) {
      this.logger.error(`Error processing audio chunk: ${err.message}`);
      client.emit('error', { message: 'Failed to process audio' });
    }
  }
}
