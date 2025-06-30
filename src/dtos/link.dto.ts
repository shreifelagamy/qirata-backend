import { IsBoolean, IsOptional, IsString, IsUrl, IsDate } from 'class-validator';

export class CreateLinkDto {
    @IsUrl()
    url!: string;

    @IsUrl()
    rss_url!: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsBoolean()
    @IsOptional()
    is_rss?: boolean;
}

export class UpdateLinkDto {
    @IsUrl()
    @IsOptional()
    url?: string;

    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    is_rss?: boolean;

    @IsBoolean()
    @IsOptional()
    is_read?: boolean;

    @IsDate()
    @IsOptional()
    last_fetch_at?: Date;
}