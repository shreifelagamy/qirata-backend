import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddIncrementalIdToPosts1920000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add sequence_id column to posts table
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "sequence_id",
                type: "serial",
                isNullable: false,
                isUnique: true
            })
        );

        // Create index on sequence_id for faster ordering
        await queryRunner.createIndex(
            "posts",
            new TableIndex({
                name: "IDX_POSTS_SEQUENCE_ID",
                columnNames: ["sequence_id"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.dropIndex("posts", "IDX_POSTS_SEQUENCE_ID");
        
        // Drop column
        await queryRunner.dropColumn("posts", "sequence_id");
    }
}