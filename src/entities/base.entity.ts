import { PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";
import { validate as uuidValidate } from 'uuid';

export abstract class BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @CreateDateColumn({ type: "timestamp with time zone" })
    created_at: Date = new Date();

    constructor() {
        this.created_at = new Date();
    }

    static isValidUUID(id: string): boolean {
        return id !== undefined && id !== null && id !== '' && uuidValidate(id);
    }
}