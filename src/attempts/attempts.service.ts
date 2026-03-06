import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { calculateBandScore, roundToIELTS } from './grading.utils';
import {
  IAttemptsDatasource,
  ATTEMPTS_DATASOURCE,
} from './attempts.datasource';
import { AIGradingService } from './grading/ai-grading.service';
import { IStorageProvider } from '../common/interfaces/storage-provider.interface';

@Injectable()
export class AttemptsService {
  private readonly EXAM_CREDIT_COST = 10;

  constructor(
    @Inject(ATTEMPTS_DATASOURCE)
    private readonly datasource: IAttemptsDatasource,
    private readonly aiGradingService: AIGradingService,
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
  ) {}

  private async resolveUser(firebaseUid: string) {
    const user = await this.datasource.findUserByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAllForUser(firebaseUid: string) {
    const user = await this.resolveUser(firebaseUid);
    return this.datasource.findAllByUser(user.id);
  }

  async create(firebaseUid: string, testId: string) {
    // 1. Verify mock test exists
    const test = await this.datasource.findMockTestById(testId);
    if (!test) {
      throw new NotFoundException(`Mock test "${testId}" not found`);
    }

    // 2. Atomic transaction for money-sensitive ops
    try {
      return await this.datasource.createAttemptWithCreditDeduction(
        firebaseUid,
        test.id,
        test.title,
        this.EXAM_CREDIT_COST,
      );
    } catch (err) {
      if (err.message?.startsWith('INSUFFICIENT_CREDITS:')) {
        const [, needed, have] = err.message.split(':');
        throw new BadRequestException(
          `Insufficient credits. You need ${needed} credits but have ${have}.`,
        );
      }
      if (err.message === 'User not found in transaction') {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
  }

  async findById(firebaseUid: string, attemptId: string) {
    const user = await this.resolveUser(firebaseUid);

    const attempt = await this.datasource.findAttemptByIdWithTest(attemptId);

    if (!attempt) {
      throw new NotFoundException(`Attempt "${attemptId}" not found`);
    }
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    // Security: Hide answers if test is still running
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      attempt.test.sections.forEach((s: any) => {
        s.questions.forEach((q: any) => {
          delete q.answerKey;
        });
      });
    }

    // Generate Presigned URL for master audio if it exists
    if (attempt.masterAudioPath) {
      try {
        (attempt as any).masterAudioUrl = await this.storageProvider.getPresignedUrl(attempt.masterAudioPath);
      } catch (err) {
        console.error('Failed to generate presigned URL for attempt master audio:', err);
      }
    }

    return attempt;
  }

  async updateAnswers(
    firebaseUid: string,
    attemptId: string,
    answers: Record<string, unknown>,
  ) {
    const user = await this.resolveUser(firebaseUid);

    const attempt = await this.datasource.findAttemptById(attemptId);
    if (!attempt)
      throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot update a completed attempt');
    }

    return this.datasource.updateAttemptAnswers(attemptId, answers);
  }

  async submit(firebaseUid: string, attemptId: string) {
    const user = await this.resolveUser(firebaseUid);

    const attempt =
      await this.datasource.findAttemptByIdWithTestAndQuestions(attemptId);

    if (!attempt)
      throw new NotFoundException(`Attempt "${attemptId}" not found`);
    if (attempt.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const answers = (attempt.answers as Record<string, any>) || {};
    const results: Record<string, any> = {};
    const aiGrades: Record<string, any> = {}; // Store detailed AI feedback
    let bandSums = 0;
    let gradedSectionsCount = 0;

    // We'll collect all AI grading promises to run them in parallel
    const aiGradingPromises: Promise<any>[] = [];

    for (const section of attempt.test.sections) {
      let sectionRawScore = 0;
      const sectionDetails: Record<string, any> = {
        type: section.type,
        questions: [],
      };

      if (section.type === 'LISTENING' || section.type === 'READING') {
        for (const question of section.questions) {
          const userAnswer = (answers[question.id] || '').trim().toLowerCase();
          const answerKey = question.answerKey as any;

          let isCorrect = false;
          let correctAnswer = '';

          if (answerKey && typeof answerKey.value === 'string') {
            correctAnswer = answerKey.value;
            // Direct match
            isCorrect = userAnswer === correctAnswer.trim().toLowerCase();

            // Smart match for MCQs (if seeder has text but student sent letter, or vice versa)
            if (!isCorrect && (question.content as any)?.options) {
              const options = (question.content as any).options;
              if (Array.isArray(options)) {
                // Check if userAnswer is a letter A/B/C matching the correctAnswer text's index
                const uIdx =
                  userAnswer.length === 1
                    ? userAnswer.toLowerCase().charCodeAt(0) - 97
                    : -1;
                const cIdx =
                  correctAnswer.length === 1
                    ? correctAnswer.toLowerCase().charCodeAt(0) - 97
                    : -1;

                if (uIdx >= 0 && uIdx < options.length) {
                  const optText = String(options[uIdx]).trim().toLowerCase();
                  if (optText === correctAnswer.trim().toLowerCase()) {
                    isCorrect = true;
                  }
                }

                // Or check if correctAnswer is a letter A/B/C matching the userAnswer text's index
                if (!isCorrect && cIdx >= 0 && cIdx < options.length) {
                  const optText = String(options[cIdx]).trim().toLowerCase();
                  if (optText === userAnswer) {
                    isCorrect = true;
                  }
                }
              }
            }
          } else if (answerKey && Array.isArray(answerKey.values)) {
            correctAnswer = answerKey.values.join(' / ');
            isCorrect = answerKey.values.some(
              (v: string) => v.trim().toLowerCase() === userAnswer,
            );
          }

          if (isCorrect) sectionRawScore++;

          sectionDetails.questions.push({
            questionId: question.id,
            isCorrect,
            userAnswer,
            correctAnswer,
          });
        }

        const band = calculateBandScore(sectionRawScore, section.type);
        sectionDetails.rawScore = sectionRawScore;
        sectionDetails.bandScore = band;

        bandSums += band;
        gradedSectionsCount++;
        results[section.id] = sectionDetails;
      } 
      else if (section.type === 'WRITING') {
        let sectionBandSum = 0;
        let essayCount = 0;

        for (const question of section.questions) {
          const studentEssay = answers[question.id];
          if (studentEssay && typeof studentEssay === 'string' && studentEssay.length > 10) {
            const taskText = (question.content as any).text;
            
            const gradePromise = this.aiGradingService.gradeWriting(taskText, studentEssay)
              .then(grade => {
                aiGrades[question.id] = grade;
                return grade.overallBand;
              })
              .catch(err => {
                console.error(`AI Grading failed for writing question ${question.id}:`, err);
                return null;
              });
            
            aiGradingPromises.push(gradePromise);
            essayCount++;
          }
        }

        sectionDetails.status = 'AI_GRADING_IN_PROGRESS';
        results[section.id] = sectionDetails;
      }
      else if (section.type === 'SPEAKING') {
        for (const question of section.questions) {
          const transcriptData = answers[question.id];
          if (transcriptData && transcriptData.type === 'speaking_transcript') {
            const gradePromise = this.aiGradingService.gradeSpeaking(transcriptData.history)
              .then(grade => {
                aiGrades[question.id] = grade;
                return grade.overallBand;
              })
              .catch(err => {
                console.error(`AI Grading failed for speaking question ${question.id}:`, err);
                return null;
              });

            aiGradingPromises.push(gradePromise);
          }
        }
        sectionDetails.status = 'AI_GRADING_IN_PROGRESS';
        results[section.id] = sectionDetails;
      }
    }

    // Wait for all AI grading to finish
    const aiResults = await Promise.all(aiGradingPromises);
    
    // Aggregate Writing/Speaking scores into overall band
    aiResults.forEach(score => {
      if (score !== null) {
        bandSums += score;
        gradedSectionsCount++;
      }
    });

    // Update section results with final AI scores
    for (const section of attempt.test.sections) {
      if (section.type === 'WRITING' || section.type === 'SPEAKING') {
        let sectionSum = 0;
        let count = 0;
        for (const question of section.questions) {
          if (aiGrades[question.id]) {
            sectionSum += aiGrades[question.id].overallBand;
            count++;
          }
        }
        if (count > 0) {
          results[section.id].bandScore = roundToIELTS(sectionSum / count);
          results[section.id].status = 'COMPLETED';
        } else {
          results[section.id].status = 'NOT_ATTEMPTED';
        }
      }
    }

    const overallScore =
      gradedSectionsCount > 0
        ? roundToIELTS(bandSums / gradedSectionsCount)
        : null;

    // Save detailed AI feedback and final results
    return this.datasource.updateAttemptGrades(attemptId, results, overallScore, aiGrades);
  }
}
