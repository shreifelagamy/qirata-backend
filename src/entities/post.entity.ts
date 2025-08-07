import { Entity, Column, Index, OneToMany, OneToOne, Generated } from "typeorm";
import { IsUrl, MaxLength, IsOptional, IsNotEmpty, IsNumber } from "class-validator";
import { BaseEntity } from "./base.entity";
import { SocialPost } from "./social-post.entity";
import { PostExpanded } from "./post-expanded.entity";

@Entity("posts")
export class Post extends BaseEntity {
    @Generated("increment")
    @Column({ type: "integer", unique: true })
    @Index("IDX_POSTS_SEQUENCE_ID")
    @IsNumber()
    sequence_id!: number;

    @Column({ type: "varchar", length: 255 })
    @MaxLength(255)
    @IsNotEmpty()
    title: string = "";

    @Column({ type: "text", nullable: true })
    @IsOptional()
    content?: string;

    @Column({ type: "varchar", length: 2000, nullable: true })
    @IsUrl()
    @MaxLength(2000)
    @IsOptional()
    image_url?: string;

    @Column({ type: "varchar", length: 2000 })
    @IsUrl()
    @MaxLength(2000)
    @IsNotEmpty()
    external_link: string = "";

    @Column({ type: "varchar", length: 255 })
    @MaxLength(255)
    @IsNotEmpty()
    source: string = "";

    @Column({ type: "timestamp with time zone", nullable: true })
    @Index("IDX_POSTS_READ_AT")
    read_at?: Date;

    @OneToMany(() => SocialPost, socialPost => socialPost.post)
    social_posts!: SocialPost[];

    @OneToOne(() => PostExpanded, postExpanded => postExpanded.post)
    expanded?: PostExpanded;

    constructor(partial: Partial<Post> = {}) {
        super();
        Object.assign(this, partial);
    }
}