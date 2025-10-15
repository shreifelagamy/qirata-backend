import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from "typeorm";

export class ModifyPostsTable1760528174330 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add feed_id column (nullable initially)
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "feed_id",
                type: "uuid",
                isNullable: true,
            })
        );

        // Add index on feed_id
        await queryRunner.createIndex(
            "posts",
            new TableIndex({
                name: "idx_posts_feed",
                columnNames: ["feed_id"],
            })
        );

        // Add foreign key
        await queryRunner.createForeignKey(
            "posts",
            new TableForeignKey({
                name: "fk_posts_feed",
                columnNames: ["feed_id"],
                referencedTableName: "feeds",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        // Add unique constraint on external_link
        await queryRunner.createIndex(
            "posts",
            new TableIndex({
                name: "uq_posts_external_link",
                columnNames: ["external_link"],
                isUnique: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("posts", "uq_posts_external_link");
        await queryRunner.dropForeignKey("posts", "fk_posts_feed");
        await queryRunner.dropIndex("posts", "idx_posts_feed");
        await queryRunner.dropColumn("posts", "feed_id");
    }

}
