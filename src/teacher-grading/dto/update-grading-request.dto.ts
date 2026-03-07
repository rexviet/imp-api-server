import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SaveGradingDraftDto {
  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsObject()
  rubric?: Record<string, unknown>;
}

export class SubmitGradingDto extends SaveGradingDraftDto {
  @IsNumber()
  @Min(0)
  @Max(9)
  finalScore: number;
}
