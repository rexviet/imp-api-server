-- CreateIndex
CREATE UNIQUE INDEX "grading_request_attempt_teacher_section_status_key"
ON "GradingRequest"("attemptId", "teacherId", "targetSectionType", "status");
