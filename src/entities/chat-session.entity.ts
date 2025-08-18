import { IsNotEmpty, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Message } from "./message.entity";
import { Post } from "./post.entity";
import { SocialPost } from "./social-post.entity";

@Entity("chat_sessions")
export class ChatSession extends BaseEntity {
    @Column({ type: "varchar", length: 255 })
    @MaxLength(255)
    @IsNotEmpty()
    title: string = "";

    @Column({ type: "uuid", nullable: true })
    post_id?: string;

    @ManyToOne(() => Post, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "post_id" })
    post?: Post;

    @OneToMany(() => Message, message => message.chat_session)
    messages!: Message[];

    @OneToMany(() => SocialPost, socialPost => socialPost.chat_session)
    social_posts!: SocialPost[];

    @Column({ type: "text", nullable: true })
    summary?: string;

    @Column({ type: "timestamp", nullable: true })
    last_summary_at?: Date;

    @Column({ type: "boolean", default: false })
    is_favorite: boolean = false;

    @CreateDateColumn({ name: "created_at" })
    created_at: Date = new Date();

    constructor(partial: Partial<ChatSession> = {}) {
        super();
        Object.assign(this, partial);
    }
}