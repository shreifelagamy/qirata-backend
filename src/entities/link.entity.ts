import { IsBoolean, IsOptional, IsUrl, MaxLength } from "class-validator";
import { Column, Entity } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("links")
export class Link extends BaseEntity {
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

    @Column({ type: "varchar", length: 2000, unique: true, nullable: false })
    @IsUrl()
    @MaxLength(100)
    rss_url: string = "";

    constructor(partial: Partial<Link> = {}) {
        super();
        Object.assign(this, partial);
    }
}