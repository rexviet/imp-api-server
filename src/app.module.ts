import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CreditsModule } from './credits/credits.module';
import { PrismaModule } from './prisma/prisma.module';
import { MockTestsModule } from './mock-tests/mock-tests.module';
import { AttemptsModule } from './attempts/attempts.module';
import { SpeakingModule } from './speaking/speaking.module';
import { AIModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    AdminModule,
    UsersModule,
    CreditsModule,
    PrismaModule,
    MockTestsModule,
    AttemptsModule,
    SpeakingModule,
    AIModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
