import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { ChatMessage } from '../../ai/ai-engine.interface';

export interface WritingGrade {
  taskResponse: { score: number; feedback: string };
  coherenceCohesion: { score: number; feedback: string };
  lexicalResource: { score: number; feedback: string };
  grammaticalRangeAccuracy: { score: number; feedback: string };
  overallBand: number;
  generalFeedback: string;
}

export interface SpeakingGrade {
  fluencyCoherence: { score: number; feedback: string };
  lexicalResource: { score: number; feedback: string };
  grammaticalRangeAccuracy: { score: number; feedback: string };
  pronunciation: { score: number; feedback: string };
  overallBand: number;
  generalFeedback: string;
}

@Injectable()
export class AIGradingService {
  private readonly logger = new Logger(AIGradingService.name);

  constructor(private readonly aiService: AIService) {}

  async gradeWriting(
    taskDescription: string,
    studentEssay: string,
  ): Promise<WritingGrade> {
    this.logger.log('Grading Writing attempt...');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert IELTS Writing examiner. 
Grade the user's essay based on the official IELTS assessment criteria:
1. Task Achievement (for Task 1) or Task Response (for Task 2)
2. Coherence and Cohesion
3. Lexical Resource
4. Grammatical Range and Accuracy

Return a structured JSON response with a band score (0-9, increments of 0.5) and concise feedback for each criterion.`,
      },
      {
        role: 'user',
        content: `TASK DESCRIPTION:
${taskDescription}

STUDENT RESPONSE:
${studentEssay}

Return JSON with keys: taskResponse, coherenceCohesion, lexicalResource, grammaticalRangeAccuracy, overallBand, generalFeedback. 
Format for each criterion key: { "score": number, "feedback": string }.`,
      },
    ];

    const schema = {
      type: 'object',
      properties: {
        taskResponse: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        coherenceCohesion: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        lexicalResource: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        grammaticalRangeAccuracy: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        overallBand: { type: 'number' },
        generalFeedback: { type: 'string' },
      },
      required: [
        'taskResponse',
        'coherenceCohesion',
        'lexicalResource',
        'grammaticalRangeAccuracy',
        'overallBand',
        'generalFeedback',
      ],
    };

    return this.aiService.generateStructuredResponse<WritingGrade>(
      messages,
      schema,
    );
  }

  async gradeSpeaking(
    transcriptHistory: { role: string; content: string }[],
  ): Promise<SpeakingGrade> {
    this.logger.log('Grading Speaking attempt...');

    const transcriptText = transcriptHistory
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert IELTS Speaking examiner. 
Grade the user's performance based on the transcript of their session.
Assessment Criteria:
1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation (Note: Infer pronunciation issues if the transcript shows phonetically weird words or if specified by STT confidence, otherwise assume standard based on flow).

Return a structured JSON response with a band score (0-9, increments of 0.5) and concise feedback for each criterion.`,
      },
      {
        role: 'user',
        content: `TRANSCRIPT:
${transcriptText}

Return JSON with keys: fluencyCoherence, lexicalResource, grammaticalRangeAccuracy, pronunciation, overallBand, generalFeedback.
Format for each criterion key: { "score": number, "feedback": string }.`,
      },
    ];

    const schema = {
      type: 'object',
      properties: {
        fluencyCoherence: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        lexicalResource: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        grammaticalRangeAccuracy: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        pronunciation: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['score', 'feedback'],
        },
        overallBand: { type: 'number' },
        generalFeedback: { type: 'string' },
      },
      required: [
        'fluencyCoherence',
        'lexicalResource',
        'grammaticalRangeAccuracy',
        'pronunciation',
        'overallBand',
        'generalFeedback',
      ],
    };

    return this.aiService.generateStructuredResponse<SpeakingGrade>(
      messages,
      schema,
    );
  }
}
