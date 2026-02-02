import { IsNotEmpty, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("chat_sessions")
export class ChatSession extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "chat_sessions", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "varchar", length: 255 })
    @MaxLength(255)
    @IsNotEmpty()
    title: string = "";

    @Column({ type: "uuid", nullable: true })
    post_id?: string;

    @ManyToOne("Post", { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "post_id" })
    post?: any;

    @OneToMany("Message", "chat_session")
    messages!: any[];

    @OneToMany("SocialPost", "chat_session")
    social_posts!: any[];

    @Column({ type: "text", nullable: true })
    summary?: string;

    @Column({ type: "timestamp", nullable: true })
    last_summary_at?: Date;

    @Column({ type: "boolean", default: false })
    is_favorite: boolean = false;

    @Column({ type: "text", nullable: true })
    last_intent?: string;

    @CreateDateColumn({ name: "created_at" })
    created_at: Date = new Date();

    constructor(partial: Partial<ChatSession> = {}) {
        super();
        Object.assign(this, partial);
    }
}