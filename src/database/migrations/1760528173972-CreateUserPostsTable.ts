import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateUserPostsTable1760528173972 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "user_posts",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "gen_random_uuid()",
                    },
                    {
                        name: "user_id",
                        type: "varchar",
                        isNullable: false,
                    },
                    {
                        name: "post_id",
                        type: "uuid",
                        isNullable: false,
                    },
                    {
                        name: "read_at",
                        type: "timestamp with time zone",
                        isNullable: true,
                    },
                    {
                        name: "bookmarked",
                        type: "boolean",
                        default: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            "user_posts",
            new TableIndex({
                name: "idx_user_posts_user",
                columnNames: ["user_id"],
            })
        );

        await queryRunner.createIndex(
            "user_posts",
            new TableIndex({
                name: "idx_user_posts_read",
                columnNames: ["read_at"],
            })
        );

        // Partial index for bookmarked posts
        await queryRunner.query(`
            CREATE INDEX idx_user_posts_bookmarked 
            ON user_posts (user_id, post_id) 
            WHERE bookmarked = true;
        `);

        // Create unique constraint
        await queryRunner.createIndex(
            "user_posts",
            new TableIndex({
                name: "uq_user_posts_user_post",
                columnNames: ["user_id", "post_id"],
                isUnique: true,
            })
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            "user_posts",
            new TableForeignKey({
                name: "fk_user_posts_user",
                columnNames: ["user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "user_posts",
            new TableForeignKey({
                name: "fk_user_posts_post",
                columnNames: ["post_id"],
                referencedTableName: "posts",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("user_posts", "fk_user_posts_post");
        await queryRunner.dropForeignKey("user_posts", "fk_user_posts_user");
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_posts_bookmarked;`);
        await queryRunner.dropTable("user_posts");
    }

}
