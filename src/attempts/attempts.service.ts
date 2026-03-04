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

@Injectable()
export class AttemptsService {
  private readonly EXAM_CREDIT_COST = 10;

  constructor(
    @Inject(ATTEMPTS_DATASOURCE)
    private readonly datasource: IAttemptsDatasource,
  ) {}

  private async resolveUser(firebaseUid: string) {
    const user = await this.datasource.findUserByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
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

    const answers = (attempt.answers as Record<string, string>) || {};
    const results: Record<string, any> = {};
    let bandSums = 0;
    let gradedSectionsCount = 0;

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
            isCorrect = userAnswer === correctAnswer.trim().toLowerCase();
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
      } else {
        sectionDetails.status = 'PENDING_EVALUATION';
      }

      results[section.id] = sectionDetails;
    }

    const overallScore =
      gradedSectionsCount > 0
        ? roundToIELTS(bandSums / gradedSectionsCount)
        : null;

    return this.datasource.updateAttemptGrades(attemptId, results, overallScore);
  }
}
