import { Module } from '@nestjs/common';
import { SpeakingGateway } from './speaking.gateway';
import { SttService } from './stt.service';
import { SpeakingSessionService } from './speaking-session.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  providers: [SpeakingGateway, SttService, SpeakingSessionService],
})
export class SpeakingModule {}
