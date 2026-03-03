import { Module } from '@nestjs/common';
import { SpeakingGateway } from './speaking.gateway';

@Module({
  providers: [SpeakingGateway],
})
export class SpeakingModule {}
