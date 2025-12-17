import { IsBoolean, IsOptional, IsUrl, MaxLength, IsNotEmpty } from "class-validator";
import { Column, Entity, ManyToOne, JoinColumn, Unique } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("links")
@Unique("UQ_links_rss_url_user_id", ["rss_url", "user_id"])
export class Link extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "links", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "timestamp", nullable: true })
    @IsOptional()
    last_fetch_at?: Date;

    @Column({ type: "varchar", length: 100, nullable: false })
    @MaxLength(100)
    name: string = "";

    @Column({ type: "varchar", length: 2000, unique: false, nullable: false })
    @IsUrl()
    @MaxLength(2000)
    url: string = "";

    @Column({ type: "boolean", default: false })
    @IsBoolean()
    is_rss: boolean = false;

    @Column({ type: "varchar", length: 2000, unique: false, nullable: false })
    @IsUrl()
    @MaxLength(100)
    rss_url: string = "";

    @Column({ type: "varchar", length: 2000, nullable: true })
    @IsOptional()
    @IsUrl()
    @MaxLength(2000)
    favicon_url?: string;

    constructor(partial: Partial<Link> = {}) {
        super();
        Object.assign(this, partial);
    }
}