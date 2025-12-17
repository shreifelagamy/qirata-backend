import { Entity, Column, OneToMany } from "typeorm";
import { IsEmail, IsNotEmpty, MaxLength, IsOptional, IsBoolean } from "class-validator";
import { BaseEntity } from "./base.entity";

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
    @OneToMany("ChatSession", "user")
    chat_sessions!: any[];

    @OneToMany("Link", "user")
    links!: any[];

    @OneToMany("Message", "user")
    messages!: any[];

    @OneToMany("SocialPost", "user")
    social_posts!: any[];

    @OneToMany("Settings", "user")
    settings!: any[];

    @OneToMany("UserFeed", "user")
    user_feeds!: any[];

    @OneToMany("UserPost", "user")
    user_posts!: any[];

    @OneToMany("Category", "user")
    categories!: any[];

    constructor(partial: Partial<User> = {}) {
        super();
        Object.assign(this, partial);
    }
}