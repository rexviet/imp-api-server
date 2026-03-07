-- AlterEnum
ALTER TYPE "GradingStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "GradingRequest" ADD COLUMN     "rubric" JSONB;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "headline" TEXT;

