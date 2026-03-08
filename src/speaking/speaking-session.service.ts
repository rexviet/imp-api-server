import { Injectable, Logger, Inject } from '@nestjs/common';
import { AIService } from '../ai/ai.service';
import { ChatMessage } from '../ai/ai-engine.interface';
import { SttService } from './stt.service';
import { IStorageProvider } from '../common/interfaces/storage-provider.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpeakingSessionService {
  private readonly logger = new Logger(SpeakingSessionService.name);

  // In-memory sessions structure: Map<attemptId, { history: ChatMessage[], questionId: string }>
  private sessions = new Map<
    string,
    { history: ChatMessage[]; questionId: string }
  >();

  constructor(
    private readonly aiService: AIService,
    private readonly sttService: SttService,
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  private async assertAttemptOwnership(
    firebaseUid: string,
    attemptId: string,
  ): Promise<void> {
    const attempt = await this.prisma.client.userAttempt.findFirst({
      where: {
        id: attemptId,
        user: {
          firebaseUid,
        },
      },
      select: { id: true },
    });

    if (!attempt) {
      throw new Error('ATTEMPT_NOT_FOUND_OR_FORBIDDEN');
    }
  }

  /**
   * Generates a presigned upload URL for the master record.
   * Updates the attempt record with the planned storage path.
   */
  async createUploadUrl(
    attemptId: string,
    firebaseUid: string,
  ): Promise<string> {
    await this.assertAttemptOwnership(firebaseUid, attemptId);

    const path = `speaking/master-records/${attemptId}.webm`;
    const bucket = process.env.MINIO_BUCKET || 'ielts-master-records';

    const uploadUrl = await this.storageProvider.getPresignedUploadUrl(path);

    // Update the database with storage details
    await this.prisma.client.userAttempt.update({
      where: { id: attemptId },
      data: {
        masterAudioBucket: bucket,
        masterAudioPath: path,
      },
    });

    return uploadUrl;
  }

  /**
   * Generates a presigned GET URL for reviewing the master record.
   */
  async getDownloadUrl(attemptId: string): Promise<string> {
    const attempt = await this.prisma.client.userAttempt.findUnique({
      where: { id: attemptId },
      select: { masterAudioBucket: true, masterAudioPath: true },
    });

    if (!attempt || !attempt.masterAudioPath) {
      throw new Error('Master record not found for this attempt');
    }

    return this.storageProvider.getPresignedUrl(attempt.masterAudioPath);
  }

  /**
   * Initializes a session and returns the examiner's opening line.
   */
  async initializeSession(
    attemptId: string,
    questionId: string,
    questionContext?: string,
    firebaseUid?: string,
  ): Promise<string> {
    if (firebaseUid) {
      await this.assertAttemptOwnership(firebaseUid, attemptId);
    }

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are an IELTS Speaking examiner. 
Maintain a friendly but professional tone. Do not write actions (like *nodding* or *smiling*). Only output speech.
Keep responses concise, conversational, and under 50 words.
Ask one question at a time and wait for the student's response.

CURRENT TASK: 
${
  questionContext ||
  'Start by welcoming the student to the IELTS speaking test Part 1, ask for their full name, and then proceed to a light introductory question.'
}

INSTRUCTION: 
If this is Part 2 (Cue Card), ask the student to begin their 2-minute talk based on the card. 
Otherwise, start the conversation naturally based on the task description above.`,
    };

    const initialHistory: ChatMessage[] = [
      systemPrompt,
      {
        role: 'user',
        content: '(The student walks in and sits down. Begin the test.)',
      },
    ];

    const examinerOpening = await this.aiService.generateResponse(
      initialHistory,
    );
    initialHistory.push({ role: 'model', content: examinerOpening });

    this.sessions.set(attemptId, {
      history: initialHistory,
      questionId,
    });

    return examinerOpening;
  }

  /**
   * Processes a turn: Audio -> STT -> LLM -> Reply
   */
  async processTurn(
    attemptId: string,
    audioBase64: string,
    firebaseUid?: string,
  ): Promise<{ transcript: string; nextQuestion: string }> {
    if (firebaseUid) {
      await this.assertAttemptOwnership(firebaseUid, attemptId);
    }

    const session = this.sessions.get(attemptId);
    if (!session) {
      this.logger.error(`Attempt ${attemptId} has no active session.`);
      throw new Error('Session not initialized');
    }

    // 1. Process Audio to Text
    const studentTranscript = await this.sttService.transcribeAudio(
      audioBase64,
    );

    if (!studentTranscript) {
      throw new Error('Could not transcribe audio (no speech detected)');
    }

    session.history.push({ role: 'user', content: studentTranscript });

    // 2. Generate Reply using Gemini AI Adapter
    const examinerReply = await this.aiService.generateResponse(
      session.history,
    );

    session.history.push({ role: 'model', content: examinerReply });

    return {
      transcript: studentTranscript,
      nextQuestion: examinerReply,
    };
  }

  async endSession(attemptId: string, firebaseUid?: string) {
    if (firebaseUid) {
      await this.assertAttemptOwnership(firebaseUid, attemptId);
    }

    const session = this.sessions.get(attemptId);
    if (session) {
      try {
        // Persist transcript to the attempt record
        const attempt = await this.prisma.client.userAttempt.findUnique({
          where: { id: attemptId },
        });

        const currentAnswers = (attempt?.answers as Record<string, any>) || {};
        currentAnswers[session.questionId] = {
          type: 'speaking_transcript',
          history: session.history.filter(
            (m) =>
              m.role !== 'system' &&
              !m.content.includes('(The student walks in'),
          ),
        };

        await this.prisma.client.userAttempt.update({
          where: { id: attemptId },
          data: { answers: currentAnswers },
        });

        this.logger.log(
          `Persisted speaking transcript for attempt ${attemptId}, question ${session.questionId}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to persist speaking transcript: ${err.message}`,
        );
      }
      this.sessions.delete(attemptId);
    }
  }
}
