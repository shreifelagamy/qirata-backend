import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from "typeorm";
import { MaxLength, IsNotEmpty, IsOptional } from "class-validator";

@Entity("user_feeds")
@Index("uq_user_feeds_user_feed", ["user_id", "feed_id"], { unique: true })
export class UserFeed {
    @PrimaryGeneratedColumn("uuid")
    id!: string;
    @Column({ type: "varchar" })
    @Index("idx_user_feeds_user")
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "user_feeds", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "uuid" })
    @Index("idx_user_feeds_feed")
    @IsNotEmpty()
    feed_id!: string;

    @ManyToOne("Feed", "user_feeds", { onDelete: "CASCADE" })
    @JoinColumn({ name: "feed_id" })
    feed!: any;

    @Column({ type: "uuid", nullable: true })
    @Index("idx_user_feeds_category", ["user_id", "category_id"])
    @IsOptional()
    category_id?: string;

    @ManyToOne("Category", "user_feeds", {
        onDelete: "SET NULL",
        nullable: true
    })
    @JoinColumn({ name: "category_id" })
    category?: any;

    @Column({ type: "varchar", length: 255, nullable: true })
    @MaxLength(255)
    @IsOptional()
    custom_name?: string;

    @Column({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
    subscribed_at: Date = new Date();

    constructor(partial: Partial<UserFeed> = {}) {
        Object.assign(this, partial);
    }
}
