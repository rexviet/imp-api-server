import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AI_ENGINE } from './ai-engine.interface';
import { GeminiAdapter } from './adapters/gemini.adapter';

@Module({
  providers: [
    AIService,
    {
      provide: AI_ENGINE,
      useClass: GeminiAdapter, // Inject Gemini API implementation
    },
  ],
  exports: [AIService], // Export for use in other modules (e.g., SpeakingModule)
})
export class AIModule {}
