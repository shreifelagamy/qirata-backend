import { Entity, Column, UpdateDateColumn, Index } from "typeorm";
import { IsNotEmpty, MaxLength } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("settings")
export class Settings extends BaseEntity {
    @Column({ type: "varchar", length: 100, unique: true })
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