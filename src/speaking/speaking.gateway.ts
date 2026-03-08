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
  namespace: 'speaking',
  cors: {
    origin: true,
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
export class SpeakingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly MAX_AUDIO_BASE64_LENGTH = 1_000_000;
  private readonly AUDIO_CHUNK_WINDOW_MS = 10_000;
  private readonly MAX_AUDIO_CHUNKS_PER_WINDOW = 12;

  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('SpeakingGateway');
  private clientToAttemptMap = new Map<string, string>();
  private clientChunkTimestamps = new Map<string, number[]>();

  constructor(private speakingSessionService: SpeakingSessionService) {}

  private getFirebaseUid(client: Socket): string {
    const uid = (client as Socket & { user?: { uid?: string } }).user?.uid;
    if (!uid) {
      throw new Error('UNAUTHORIZED_SOCKET');
    }
    return uid;
  }

  private assertClientAttemptScope(client: Socket, attemptId: string): void {
    const mappedAttemptId = this.clientToAttemptMap.get(client.id);
    if (!mappedAttemptId || mappedAttemptId !== attemptId) {
      throw new Error('ATTEMPT_SCOPE_MISMATCH');
    }
  }

  private emitSocketError(client: Socket, error: Error): void {
    if (
      error.message === 'UNAUTHORIZED_SOCKET' ||
      error.message === 'ATTEMPT_NOT_FOUND_OR_FORBIDDEN' ||
      error.message === 'ATTEMPT_SCOPE_MISMATCH'
    ) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    client.emit('error', {
      message: 'Failed to process speaking request',
    });
  }

  private assertAudioChunkRateLimit(client: Socket): void {
    const now = Date.now();
    const windowStart = now - this.AUDIO_CHUNK_WINDOW_MS;
    const recentTimestamps =
      this.clientChunkTimestamps
        .get(client.id)
        ?.filter((ts) => ts >= windowStart) ?? [];

    if (recentTimestamps.length >= this.MAX_AUDIO_CHUNKS_PER_WINDOW) {
      throw new Error('AUDIO_CHUNK_RATE_LIMIT_EXCEEDED');
    }

    recentTimestamps.push(now);
    this.clientChunkTimestamps.set(client.id, recentTimestamps);
  }

  afterInit(server: Server) {
    this.logger.log('Speaking Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(
      `[DISCONNECT] Client disconnected: ${client.id}, Reason: ${
        client.connected ? 'STILL CONNECTED' : 'CLOSED'
      }`,
    );
    this.logger.log(`Client disconnected: ${client.id}`);
    const attemptId = this.clientToAttemptMap.get(client.id);
    if (attemptId) {
      this.logger.log(
        `Cleaning up session for attempt: ${attemptId} after abrupt disconnect`,
      );
      try {
        const firebaseUid = this.getFirebaseUid(client);
        await this.speakingSessionService.endSession(attemptId, firebaseUid);
      } catch (err) {
        this.logger.error(
          `Failed to end session on disconnect for attempt ${attemptId}: ${err.message}`,
        );
      }
      this.clientToAttemptMap.delete(client.id);
      this.clientChunkTimestamps.delete(client.id);
    }
  }

  @SubscribeMessage('join-speaking-test')
  async handleJoin(
    @MessageBody()
    data: { attemptId: string; questionId: string; questionContext?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Client ${client.id} joined attempt: ${data.attemptId} for question: ${data.questionId}`,
    );

    try {
      const firebaseUid = this.getFirebaseUid(client);

      // Initialize Gemini Chat context and get opener
      const opener = await this.speakingSessionService.initializeSession(
        data.attemptId,
        data.questionId,
        data.questionContext,
        firebaseUid,
      );

      client.join(data.attemptId);
      this.clientToAttemptMap.set(client.id, data.attemptId);

      client.emit('examiner-ready', {
        message: opener,
      });
    } catch (e) {
      this.logger.error(`Failed to initialize session: ${e.message}`);
      this.emitSocketError(client, e);
    }
  }

  @SubscribeMessage('send-audio-chunk')
  async handleAudioChunk(
    @MessageBody() data: { attemptId: string; audio: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.assertClientAttemptScope(client, data.attemptId);
      this.assertAudioChunkRateLimit(client);

      this.logger.log(
        `Received audio chunk from ${client.id} for attempt ${data.attemptId}`,
      );

      if (!data.audio || !data.attemptId) {
        throw new Error(
          'Invalid data payload (missing audio buffer or attemptId)',
        );
      }
      if (data.audio.length > this.MAX_AUDIO_BASE64_LENGTH) {
        throw new Error('Audio payload too large');
      }

      const firebaseUid = this.getFirebaseUid(client);

      // STT -> LLM Pipeline Turn
      const reply = await this.speakingSessionService.processTurn(
        data.attemptId,
        data.audio,
        firebaseUid,
      );

      client.emit('examiner-response', {
        transcript: reply.transcript,
        nextQuestion: reply.nextQuestion,
      });
    } catch (err) {
      this.logger.error(`Error processing audio turn: ${err.message}`);
      this.emitSocketError(client, err);
    }
  }

  @SubscribeMessage('end-speaking-test')
  async handleEnd(
    @MessageBody() data: { attemptId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.assertClientAttemptScope(client, data.attemptId);
      const firebaseUid = this.getFirebaseUid(client);

      this.logger.log(`Client ${client.id} ended attempt ${data.attemptId}`);
      await this.speakingSessionService.endSession(data.attemptId, firebaseUid);
      this.clientToAttemptMap.delete(client.id);
      this.clientChunkTimestamps.delete(client.id);
      client.leave(data.attemptId);
    } catch (err) {
      this.logger.error(`Error ending speaking session: ${err.message}`);
      this.emitSocketError(client, err);
    }
  }

  @SubscribeMessage('request-upload-url')
  async handleRequestUploadUrl(
    @MessageBody() data: { attemptId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.assertClientAttemptScope(client, data.attemptId);
      const firebaseUid = this.getFirebaseUid(client);

      this.logger.log(
        `Client ${client.id} requesting upload URL for attempt ${data.attemptId}`,
      );
      const uploadUrl = await this.speakingSessionService.createUploadUrl(
        data.attemptId,
        firebaseUid,
      );
      client.emit('upload-url-ready', { uploadUrl });
    } catch (err) {
      this.logger.error(`Error generating upload URL: ${err.message}`);
      this.emitSocketError(client, err);
    }
  }
}
