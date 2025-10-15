import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { IsNotEmpty, IsBoolean, IsOptional } from "class-validator";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Post } from "./post.entity";

@Entity("user_posts")
@Index("uq_user_posts_user_post", ["user_id", "post_id"], { unique: true })
export class UserPost extends BaseEntity {
    @Column({ type: "varchar" })
    @Index("idx_user_posts_user")
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne(() => User, user => user.user_posts, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "uuid" })
    @IsNotEmpty()
    post_id!: string;

    @ManyToOne(() => Post, post => post.user_posts, { onDelete: "CASCADE" })
    @JoinColumn({ name: "post_id" })
    post!: Post;

    @Column({ type: "timestamp with time zone", nullable: true })
    @Index("idx_user_posts_read")
    @IsOptional()
    read_at?: Date;

    @Column({ type: "boolean", default: false })
    @IsBoolean()
    bookmarked: boolean = false;

    @Column({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date = new Date();

    constructor(partial: Partial<UserPost> = {}) {
        super();
        Object.assign(this, partial);
    }
}
