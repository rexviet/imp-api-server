export interface ChatMessage {
  role: 'system' | 'user' | 'model';
  content: string;
}

export const AI_ENGINE = Symbol('AI_ENGINE');

export interface IAIEngine {
  /**
   * Generates a single text response based on the conversation history.
   */
  generateResponse(messages: ChatMessage[]): Promise<string>;

  /**
   * Generates a streaming text response, yielding chunks of text as they arrive.
   */
  generateResponseStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown>;

  /**
   * Generates a structured JSON response (e.g., for grading).
   * @param messages Conversation context
   * @param schema Optional JSON schema for the expected output
   */
  generateStructuredResponse<T>(messages: ChatMessage[], schema?: any): Promise<T>;
}
