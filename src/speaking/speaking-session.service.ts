import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../ai/ai.service';
import { ChatMessage } from '../ai/ai-engine.interface';
import { SttService } from './stt.service';

@Injectable()
export class SpeakingSessionService {
  private readonly logger = new Logger(SpeakingSessionService.name);

  // In-memory sessions structure: Map<attemptId, ChatMessage[]>
  private sessions = new Map<string, ChatMessage[]>();

  constructor(
    private readonly aiService: AIService,
    private readonly sttService: SttService,
  ) {}

  /**
   * Initializes a session and returns the examiner's opening line.
   */
  async initializeSession(attemptId: string): Promise<string> {
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are an IELTS Speaking examiner. 
Maintain a friendly but professional tone. Do not write actions. Only output speech.
Keep responses concise, conversational, and under 50 words.
Ask one question at a time and wait for the student's response.
Start by welcoming the student to the IELTS speaking test Part 1, ask for their full name, and then proceed to a light introductory question.`
    };

    const initialHistory: ChatMessage[] = [systemPrompt];
    
    // Have the AI generate the real first question based on the prompt
    // Wait, since there is no 'user' turn yet, Gemini might object if the first turn is not 'user'.
    // Gemini normally requires the chat to start with user. 
    // Let's seed the conversation to prompt the examiner to start.
    
    initialHistory.push({ role: 'user', content: '(The student walks in and sits down. Begin the test.)' });
    
    this.sessions.set(attemptId, initialHistory);

    const examinerOpening = await this.aiService.generateResponse(initialHistory);
    initialHistory.push({ role: 'model', content: examinerOpening });
    
    return examinerOpening;
  }

  /**
   * Processes a turn: Audio -> STT -> LLM -> Reply
   */
  async processTurn(attemptId: string, audioBase64: string): Promise<{ transcript: string, nextQuestion: string }> {
    const history = this.sessions.get(attemptId);
    if (!history) {
      this.logger.error(`Attempt ${attemptId} has no active session.`);
      throw new Error('Session not initialized');
    }

    // 1. Process Audio to Text
    const studentTranscript = await this.sttService.transcribeAudio(audioBase64);
    
    if (!studentTranscript) {
      throw new Error('Could not transcribe audio (no speech detected)');
    }

    history.push({ role: 'user', content: studentTranscript });

    // 2. Generate Reply using Gemini AI Adapter
    const examinerReply = await this.aiService.generateResponse(history);
    
    history.push({ role: 'model', content: examinerReply });

    return {
      transcript: studentTranscript,
      nextQuestion: examinerReply
    };
  }

  endSession(attemptId: string) {
    this.sessions.delete(attemptId);
  }
}
