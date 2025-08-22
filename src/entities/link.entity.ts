import { IsBoolean, IsOptional, IsUrl, MaxLength, IsNotEmpty } from "class-validator";
import { Column, Entity, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

@Entity("links")
export class Link extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne(() => User, user => user.links, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

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