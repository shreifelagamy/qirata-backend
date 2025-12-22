import { Entity, Column, Index, OneToMany } from "typeorm";
import { IsUrl, MaxLength, IsOptional, IsNotEmpty, IsNumber, IsIn } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("feeds")
export class Feed extends BaseEntity {
    @Column({ type: "varchar", length: 2000, unique: true })
    @Index("idx_feeds_url")
    @IsUrl()
    @MaxLength(2000)
    @IsNotEmpty()
    url: string = "";

    @Column({ type: "varchar", length: 255 })
    @Index("idx_feeds_name")
    @MaxLength(255)
    @IsNotEmpty()
    name: string = "";

    @Column({ type: "varchar", length: 2000, nullable: true })
    @IsUrl()
    @MaxLength(2000)
    @IsOptional()
    favicon_url?: string;

    @Column({ type: "timestamp with time zone", nullable: true })
    @Index("idx_feeds_last_fetch")
    @IsOptional()
    last_fetch_at?: Date;

    @Column({ type: "timestamp with time zone", nullable: true })
    @IsOptional()
    last_modified?: Date;

    @Column({ type: "varchar", length: 255, nullable: true })
    @MaxLength(255)
    @IsOptional()
    etag?: string;

    @Column({ type: "integer", default: 0 })
    @IsNumber()
    fetch_error_count: number = 0;

    @Column({ type: "varchar", length: 20, default: "active" })
    @Index("idx_feeds_status")
    @IsIn(["active", "inactive", "error"])
    status: string = "active";

    @Column({ type: "integer", default: 0 })
    @IsNumber()
    subscriber_count: number = 0;

    @OneToMany("UserFeed", "feed")
    user_feeds!: any[];

    @OneToMany("Post", "feed")
    posts!: any[];

    @OneToMany("FeedFetchLog", "feed")
    feed_fetch_logs!: any[];

    constructor(partial: Partial<Feed> = {}) {
        super();
        Object.assign(this, partial);
    }
}
