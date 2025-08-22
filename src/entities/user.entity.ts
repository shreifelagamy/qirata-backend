import { Entity, Column, OneToMany } from "typeorm";
import { IsEmail, IsNotEmpty, MaxLength, IsOptional, IsBoolean } from "class-validator";
import { BaseEntity } from "./base.entity";
import { ChatSession } from "./chat-session.entity";
import { Link } from "./link.entity";
import { Post } from "./post.entity";
import { PostExpanded } from "./post-expanded.entity";
import { Message } from "./message.entity";
import { SocialPost } from "./social-post.entity";
import { Settings } from "./settings.entity";

@Entity("user")
export class User extends BaseEntity {
    @Column({ type: "varchar", length: 255 })
    @MaxLength(255)
    @IsNotEmpty()
    name: string = "";

    @Column({ type: "varchar", length: 255, unique: true })
    @IsEmail()
    @MaxLength(255)
    @IsNotEmpty()
    email: string = "";

    @Column({ type: "boolean", default: false })
    @IsBoolean()
    emailVerified: boolean = false;

    @Column({ type: "varchar", length: 500, nullable: true })
    @MaxLength(500)
    @IsOptional()
    image?: string;

    // Relationships to user's data
    @OneToMany(() => ChatSession, chatSession => chatSession.user)
    chat_sessions!: ChatSession[];

    @OneToMany(() => Link, link => link.user)
    links!: Link[];

    @OneToMany(() => Post, post => post.user)
    posts!: Post[];

    @OneToMany(() => PostExpanded, postExpanded => postExpanded.user)
    expanded_posts!: PostExpanded[];

    @OneToMany(() => Message, message => message.user)
    messages!: Message[];

    @OneToMany(() => SocialPost, socialPost => socialPost.user)
    social_posts!: SocialPost[];

    @OneToMany(() => Settings, settings => settings.user)
    settings!: Settings[];


    constructor(partial: Partial<User> = {}) {
        super();
        Object.assign(this, partial);
    }
}