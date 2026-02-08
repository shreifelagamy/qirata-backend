import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { IsNotEmpty } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("messages")
export class Message extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "messages", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "uuid" })
    chat_session_id: string = "";

    @ManyToOne("ChatSession", "messages", { onDelete: "CASCADE" })
    @JoinColumn({ name: "chat_session_id" })
    chat_session!: any;

    @Column({ type: "text" })
    @IsNotEmpty()
    user_message: string = "";

    @Column({ type: "text" })
    @IsNotEmpty()
    ai_response: string = "";

    @Column({ type: "uuid", nullable: true })
    social_post_id?: string;

    @ManyToOne("SocialPost", { onDelete: "SET NULL" })
    @JoinColumn({ name: "social_post_id" })
    social_post?: any;

    constructor(partial: Partial<Message> = {}) {
        super();
        Object.assign(this, partial);
    }
}
