import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { IsNotEmpty, MaxLength, IsArray, IsUrl, IsOptional, IsString } from "class-validator";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { ChatSession } from "./chat-session.entity";
import { Post } from "./post.entity";

export enum SocialPlatform {
    TWITTER = "twitter",
    LINKEDIN = "linkedin",
    FACEBOOK = "facebook",
    INSTAGRAM = "instagram"
}

export interface CodeExample {
    language: string;
    code: string;
    description?: string | null;
}

export interface VisualElement {
    type: string;
    description: string;
    suggestion?: string;
}

@Entity("social_posts")
@Unique(["chat_session_id", "platform"])
export class SocialPost extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne(() => User, user => user.social_posts, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({
        type: "varchar",
        length: 50,
        transformer: {
            to: (value: SocialPlatform) => value,
            from: (value: string) => value as SocialPlatform
        }
    })
    @MaxLength(50)
    @IsNotEmpty()
    platform: SocialPlatform = SocialPlatform.TWITTER;

    @Column({ type: "text" })
    @IsNotEmpty()
    content: string = "";

    @Column({
        type: "text",
        nullable: true,
        transformer: {
            to: (value: string[]) => value ? JSON.stringify(value) : null,
            from: (value: string) => value ? JSON.parse(value) : null
        }
    })
    @IsArray()
    @IsUrl({}, { each: true })
    @IsOptional()
    image_urls?: string[];

    @Column({ type: "uuid" })
    chat_session_id: string = "";

    @ManyToOne(() => ChatSession, chatSession => chatSession.social_posts, { onDelete: "CASCADE" })
    @JoinColumn({ name: "chat_session_id" })
    chat_session!: ChatSession;

    @Column({ type: "uuid", nullable: true })
    post_id?: string;

    @ManyToOne(() => Post, post => post.social_posts, { onDelete: "SET NULL" })
    @JoinColumn({ name: "post_id" })
    post?: Post;

    @Column({ type: "timestamp with time zone", nullable: true })
    published_at?: Date;

    @Column({
        type: "jsonb",
        nullable: true,
        transformer: {
            to: (value: CodeExample[]) => value ? JSON.stringify(value) : null,
            from: (value: string) => value ? JSON.parse(value) : null
        }
    })
    @IsArray()
    @IsOptional()
    code_examples?: CodeExample[];

    @Column({
        type: "jsonb",
        nullable: true,
        transformer: {
            to: (value: VisualElement[]) => value ? JSON.stringify(value) : null,
            from: (value: string) => value ? JSON.parse(value) : null
        }
    })
    @IsArray()
    @IsOptional()
    visual_elements?: VisualElement[];

    constructor(partial: Partial<SocialPost> = {}) {
        super();
        Object.assign(this, partial);
        this.image_urls = partial.image_urls || [];
        this.code_examples = partial.code_examples || [];
        this.visual_elements = partial.visual_elements || [];
    }
}