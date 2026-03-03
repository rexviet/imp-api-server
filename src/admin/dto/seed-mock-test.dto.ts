import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsObject,
  ValidateNested,
  Min,
} from 'class-validator';
import { TestDifficulty, SectionType } from '@prisma/client';

export class SeedQuestionDto {
  @IsInt()
  @Min(1)
  order: number;

  @IsObject()
  content: Record<string, any>;

  @IsOptional()
  @IsObject()
  answerKey?: Record<string, any>;
}

export class SeedSectionDto {
  @IsEnum(SectionType)
  type: SectionType;

  @IsInt()
  @Min(1)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedQuestionDto)
  questions: SeedQuestionDto[];
}

export class SeedMockTestDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TestDifficulty)
  difficulty: TestDifficulty;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedSectionDto)
  sections: SeedSectionDto[];
}
