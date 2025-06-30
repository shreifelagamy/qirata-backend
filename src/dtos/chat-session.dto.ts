import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChatSessionDto {
    @IsString()
    title!: string;

    @IsOptional()
    @IsUUID()
    postId?: string;
}

export class ChatSessionResponseDto {
    id!: string;
    title!: string;
    post?: any;
    messages?: any[];
    createdAt!: string;
}

export class ChatSessionsResponseDto {
    sessions!: ChatSessionResponseDto[];
    total!: number;
}
