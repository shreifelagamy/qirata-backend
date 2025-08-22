import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { IsNotEmpty, IsEnum } from "class-validator";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { ChatSession } from "./chat-session.entity";

export enum MessageType {
    MESSAGE = "message",
    SOCIAL_POST = "social_post"
}

@Entity("messages")
export class Message extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne(() => User, user => user.messages, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

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

    @Column({
        type: "varchar",
        length: 20,
        default: MessageType.MESSAGE,
        transformer: {
            to: (value: MessageType) => value,
            from: (value: string) => value as MessageType
        }
    })
    @IsEnum(MessageType)
    type: MessageType = MessageType.MESSAGE;

    constructor(partial: Partial<Message> = {}) {
        super();
        Object.assign(this, partial);
    }
}