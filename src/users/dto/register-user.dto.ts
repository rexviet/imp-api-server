import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum AllowRegisterRoles {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

export class RegisterUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AllowRegisterRoles)
  role?: AllowRegisterRoles;
}
