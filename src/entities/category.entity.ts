import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { MaxLength, IsNotEmpty, IsOptional } from "class-validator";
import { BaseEntity } from "./base.entity";

@Entity("categories")
@Index("uq_categories_user_name_parent", ["user_id", "name", "parent_id"], { unique: true })
export class Category extends BaseEntity {
    @Column({ type: "varchar" })
    @Index("idx_categories_user")
    @IsNotEmpty()
    user_id!: string;

    @ManyToOne("User", "categories", { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: any;

    @Column({ type: "varchar", length: 100 })
    @MaxLength(100)
    @IsNotEmpty()
    name: string = "";

    @Column({ type: "uuid", nullable: true })
    @Index("idx_categories_parent", ["user_id", "parent_id"])
    @IsOptional()
    parent_id?: string;

    @ManyToOne("Category", "children", {
        onDelete: "CASCADE",
        nullable: true
    })
    @JoinColumn({ name: "parent_id" })
    parent?: any;

    @OneToMany("Category", "parent")
    children!: any[];

    @OneToMany("UserFeed", "category")
    user_feeds!: any[];

    constructor(partial: Partial<Category> = {}) {
        super();
        Object.assign(this, partial);
    }
}
