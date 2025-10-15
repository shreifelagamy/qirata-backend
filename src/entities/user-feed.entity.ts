import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { MaxLength, IsNotEmpty, IsOptional } from "class-validator";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Feed } from "./feed.entity";
import { Category } from "./category.entity";

@Entity("user_feeds")
@Index("uq_user_feeds_user_feed", ["user_id", "feed_id"], { unique: true })
export class UserFeed extends BaseEntity {
    @Column({ type: "varchar" })
    @Index("idx_user_feeds_user")
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne(() => User, user => user.user_feeds, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "uuid" })
    @Index("idx_user_feeds_feed")
    @IsNotEmpty()
    feed_id!: string;

    @ManyToOne(() => Feed, feed => feed.user_feeds, { onDelete: "CASCADE" })
    @JoinColumn({ name: "feed_id" })
    feed!: Feed;

    @Column({ type: "uuid", nullable: true })
    @Index("idx_user_feeds_category", ["user_id", "category_id"])
    @IsOptional()
    category_id?: string;

    @ManyToOne(() => Category, category => category.user_feeds, {
        onDelete: "SET NULL",
        nullable: true
    })
    @JoinColumn({ name: "category_id" })
    category?: Category;

    @Column({ type: "varchar", length: 255, nullable: true })
    @MaxLength(255)
    @IsOptional()
    custom_name?: string;

    @Column({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
    subscribed_at: Date = new Date();

    constructor(partial: Partial<UserFeed> = {}) {
        super();
        Object.assign(this, partial);
    }
}
