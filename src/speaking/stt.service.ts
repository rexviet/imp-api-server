import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechClient } from '@google-cloud/speech';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private client: SpeechClient;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (projectId && privateKey && clientEmail) {
      this.client = new SpeechClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        projectId: projectId,
      });
    } else {
      this.logger.warn(
        'Google Cloud credentials not fully provided. STT Service may fail.',
      );
    }
  }

  /**
   * Converts a base64 encoded webm/audio string directly to text.
   */
  async transcribeAudio(audioBase64: string): Promise<string> {
    if (!this.client) {
      this.logger.warn('SpeechClient not initialized, returning fallback string');
      return 'Mocked Speech-to-Text response due to missing GCP credentials.';
    }

    // Strip the Data URL prefix if present (e.g., "data:audio/webm;base64,")
    const base64Data = audioBase64.replace(/^data:audio\/\w+;(codecs=.*?;)?base64,/, '');

    try {
      const request = {
        audio: {
          content: base64Data,
        },
        config: {
          // WebM from browser uses WEBM_OPUS typically
          encoding: 'WEBM_OPUS' as const,
          sampleRateHertz: 48000, // Browser default
          languageCode: 'en-US',
          alternativeLanguageCodes: ['en-GB', 'en-AU'],
        },
      };

      const [response] = await this.client.recognize(request);
      
      const transcript = response.results
        ?.map((result: any) => result.alternatives?.[0]?.transcript)
        .join('\n');

      return transcript || '';
    } catch (error) {
      this.logger.error('STT Transcription failed', error.stack);
      
      // Since webm/opus via gRPC can be finicky depending on browser encoding, 
      // let's try a fallback generic encoding if it fails or throw.
      return 'Transcription error: ' + error.message;
    }
  }
}
