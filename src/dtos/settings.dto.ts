import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSettingsDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsOptional()
  description?: string;
}