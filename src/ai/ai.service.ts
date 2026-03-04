import { Injectable, Inject } from '@nestjs/common';
import { AI_ENGINE, IAIEngine, ChatMessage } from './ai-engine.interface';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
  ) {}

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    return this.aiEngine.generateResponse(messages);
  }

  generateResponseStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    return this.aiEngine.generateResponseStream(messages);
  }

  async generateStructuredResponse<T>(
    messages: ChatMessage[],
    schema?: any,
  ): Promise<T> {
    return this.aiEngine.generateStructuredResponse<T>(messages, schema);
  }
}
