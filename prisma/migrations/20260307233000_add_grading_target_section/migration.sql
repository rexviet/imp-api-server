-- CreateEnum
CREATE TYPE "GradingTargetSection" AS ENUM ('WRITING', 'SPEAKING');

-- AlterTable
ALTER TABLE "GradingRequest"
ADD COLUMN "targetSectionType" "GradingTargetSection" NOT NULL DEFAULT 'WRITING';

-- Backfill speaking requests from attempt audio evidence
UPDATE "GradingRequest" AS gr
SET "targetSectionType" = 'SPEAKING'
FROM "UserAttempt" AS ua
WHERE gr."attemptId" = ua."id"
  AND ua."masterAudioPath" IS NOT NULL;
