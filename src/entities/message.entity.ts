import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { IsNotEmpty } from "class-validator";
import { BaseEntity } from "./base.entity";
import { ChatSession } from "./chat-session.entity";

@Entity("messages")
export class Message extends BaseEntity {
    @Column({ type: "uuid" })
    chat_session_id: string = "";

    @ManyToOne(() => ChatSession, chatSession => chatSession.messages, { onDelete: "CASCADE" })
    @JoinColumn({ name: "chat_session_id" })
    chat_session!: ChatSession;

    @Column({ type: "text" })
    @IsNotEmpty()
    user_message: string = "";

    @Column({ type: "text" })
    @IsNotEmpty()
    ai_response: string = "";

    constructor(partial: Partial<Message> = {}) {
        super();
        Object.assign(this, partial);
    }
}