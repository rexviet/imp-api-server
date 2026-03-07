import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTeacherProfileDto {
  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  creditRate?: number;
}
