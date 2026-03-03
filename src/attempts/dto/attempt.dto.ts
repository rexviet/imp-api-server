import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateAttemptDto {
  @IsString()
  testId: string;
}

export class UpdateAttemptDto {
  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;
}
