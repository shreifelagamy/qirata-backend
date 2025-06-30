import { IsNotEmpty } from "class-validator";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, UpdateDateColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Post } from "./post.entity";

@Entity("post_expanded")
export class PostExpanded extends BaseEntity {
    @Column({ type: "uuid" })
    post_id: string = "";

    @OneToOne(() => Post, { onDelete: "CASCADE" })
    @JoinColumn({ name: "post_id" })
    post!: Post;

    @Column({ type: "text" })
    @IsNotEmpty()
    content: string = "";

    @CreateDateColumn({ type: "timestamp with time zone" })
    created_at: Date = new Date();

    @UpdateDateColumn({ type: "timestamp with time zone" })
    updated_at: Date = new Date();

    constructor(partial: Partial<PostExpanded> = {}) {
        super();
        Object.assign(this, partial);
    }
}