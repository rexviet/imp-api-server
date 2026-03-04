import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  Schema,
} from '@google/generative-ai';
import { IAIEngine, ChatMessage } from '../ai-engine.interface';

@Injectable()
export class GeminiAdapter implements IAIEngine {
  private readonly logger = new Logger(GeminiAdapter.name);
  private genAI: GoogleGenerativeAI;
  private readonly defaultModel = 'gemini-2.5-flash'; // Or gemini-1.5-flash for speed

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined. AI Engine will fail if called.');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  private parseMessages(messages: ChatMessage[]) {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const historyMessages = messages.filter((m) => m.role !== 'system');

    const contents: Content[] = historyMessages.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user', // Gemini accepts 'user' | 'model'
      parts: [{ text: msg.content }],
    }));

    return { systemMessage, contents };
  }

  private getModel(
    systemInstruction?: string,
    responseMimeType?: string,
    responseSchema?: Schema,
  ): GenerativeModel {
    if (!this.genAI) throw new Error('Gemini API key not configured');

    return this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }], role: 'system' }
        : undefined,
      generationConfig: {
        responseMimeType,
        responseSchema,
      },
    });
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    const { systemMessage, contents } = this.parseMessages(messages);
    const model = this.getModel(systemMessage);

    const result = await model.generateContent({ contents });
    return result.response.text();
  }

  async *generateResponseStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const { systemMessage, contents } = this.parseMessages(messages);
    const model = this.getModel(systemMessage);

    const result = await model.generateContentStream({ contents });
    for await (const chunk of result.stream) {
      if (chunk.text()) {
        yield chunk.text();
      }
    }
  }

  async generateStructuredResponse<T>(
    messages: ChatMessage[],
    schema?: any,
  ): Promise<T> {
    const { systemMessage, contents } = this.parseMessages(messages);
    const model = this.getModel(systemMessage, 'application/json', schema);

    const result = await model.generateContent({ contents });
    const text = result.response.text();
    
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      this.logger.error('Failed to parse Gemini JSON response', e.stack);
      throw new Error('Invalid JSON format returned from AI');
    }
  }
}
