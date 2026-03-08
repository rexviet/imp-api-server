-- Ensure uniqueness only for active pending requests of the same attempt/teacher/section.
DROP INDEX IF EXISTS "grading_request_attempt_teacher_section_status_key";
CREATE UNIQUE INDEX "grading_request_pending_unique_idx"
ON "GradingRequest"("attemptId", "teacherId", "targetSectionType")
WHERE "status" = 'PENDING';
