import { IsString, IsUUID, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserPreferencesDto {
  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsEnum(['twitter', 'linkedin', 'general'])
  platform?: 'twitter' | 'linkedin' | 'general';

  @IsOptional()
  @IsEnum(['short', 'medium', 'long'])
  length?: 'short' | 'medium' | 'long';
}

export class SendMessageDto {
  @IsString()
  message: string = '';

  @IsOptional()
  @IsString()
  postContent?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  userPreferences?: UserPreferencesDto;
}

export class StreamMessageDto extends SendMessageDto {
  // Inherits all properties from SendMessageDto
  // Used specifically for streaming endpoints
}

export class ChatContextDto {
  @IsOptional()
  @IsString()
  postContent?: string;

  @IsOptional()
  @IsString({ each: true })
  previousMessages?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  userPreferences?: UserPreferencesDto;
}

export class AIConnectionTestDto {
  // Empty DTO for AI connection test endpoint
}

export class ClearSessionMemoryDto {
  @IsUUID()
  sessionId: string = '';
}