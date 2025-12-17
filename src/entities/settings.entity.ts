import { Entity, Column, UpdateDateColumn, Index, ManyToOne, JoinColumn, Unique } from "typeorm";
import { IsNotEmpty, MaxLength } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("settings")
@Unique(["user_id", "key"])
export class Settings extends BaseEntity {
    @Column({ type: "varchar" })
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "settings", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "varchar", length: 100 })
    @MaxLength(100)
    @IsNotEmpty()
    key: string = "";

    @Column({ type: "text", nullable: true })
    value?: string;

    @UpdateDateColumn({ type: "timestamp with time zone" })
    @Index("IDX_SETTINGS_UPDATED_AT")
    updated_at: Date = new Date();

    constructor(partial: Partial<Settings> = {}) {
        super();
        Object.assign(this, partial);
        this.updated_at = new Date();
    }
}