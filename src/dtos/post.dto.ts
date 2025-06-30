import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUrl, IsUUID } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsUrl()
  @IsNotEmpty()
  external_link!: string;

  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsUrl()
  @IsOptional()
  image_url?: string;

  @IsUUID()
  @IsNotEmpty()
  linkId!: string;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsUrl()
  @IsOptional()
  external_link?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsUrl()
  @IsOptional()
  image_url?: string;

  @IsUUID()
  @IsOptional()
  linkId?: string;

  @IsBoolean()
  @IsOptional()
  isRead?: boolean;
}