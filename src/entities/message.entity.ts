import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { IsNotEmpty, IsEnum } from "class-validator";
import { BaseEntity } from "./base.entity";

export enum MessageType {
    MESSAGE = "message",
    SOCIAL_POST = "social_post"
}

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