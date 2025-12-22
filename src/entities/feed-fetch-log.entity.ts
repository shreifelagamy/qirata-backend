import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { IsOptional, IsNumber, IsBoolean, MaxLength } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("feed_fetch_logs")
export class FeedFetchLog extends BaseEntity {
    @Column({ type: "uuid" })
    @IsOptional()
    feed_id!: string;

    @ManyToOne("Feed", "feed_fetch_logs", { onDelete: "CASCADE" })
    @JoinColumn({ name: "feed_id" })
    feed!: any;

    @CreateDateColumn({ type: "timestamp with time zone", default: () => "CURRENT_TIMESTAMP" })
    fetched_at: Date = new Date();

    @Column({ type: "integer", nullable: true })
    @IsNumber()
    @IsOptional()
    status_code?: number;

    @Column({ type: "integer", nullable: true })
    @IsNumber()
    @IsOptional()
    response_time_ms?: number;

    @Column({ type: "text", nullable: true })
    @MaxLength(10000)
    @IsOptional()
    error_message?: string;

    @Column({ type: "integer", default: 0 })
    @IsNumber()
    new_posts_count: number = 0;

    @Column({ type: "boolean", default: true })
    @IsBoolean()
    was_modified: boolean = true;

    constructor(partial: Partial<FeedFetchLog> = {}) {
        super();
        Object.assign(this, partial);
    }
}
