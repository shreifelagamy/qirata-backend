import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateSocialPostsTable1683556815000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "social_posts",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "platform",
                        type: "varchar",
                        length: "50",
                        isNullable: false
                    },
                    {
                        name: "content",
                        type: "text",
                        isNullable: false
                    },
                    {
                        name: "image_urls",
                        type: "text",
                        isNullable: true,
                        comment: "Stored as JSON string"
                    },
                    {
                        name: "chat_session_id",
                        type: "uuid",
                        isNullable: false
                    },
                    {
                        name: "post_id",
                        type: "uuid",
                        isNullable: true
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP"
                    },
                    {
                        name: "published_at",
                        type: "timestamp with time zone",
                        isNullable: true
                    }
                ]
            }),
            true
        );

        // Add foreign key constraint for chat_session_id
        await queryRunner.createForeignKey(
            "social_posts",
            new TableForeignKey({
                name: "FK_SOCIAL_POSTS_CHAT_SESSION_ID",
                columnNames: ["chat_session_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "chat_sessions",
                onDelete: "CASCADE"
            })
        );

        // Add foreign key constraint for post_id
        await queryRunner.createForeignKey(
            "social_posts",
            new TableForeignKey({
                name: "FK_SOCIAL_POSTS_POST_ID",
                columnNames: ["post_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "posts",
                onDelete: "SET NULL"
            })
        );

        // Create index on created_at
        await queryRunner.createIndex(
            "social_posts",
            new TableIndex({
                name: "IDX_SOCIAL_POSTS_CREATED_AT",
                columnNames: ["created_at"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("social_posts", "IDX_SOCIAL_POSTS_CREATED_AT");
        await queryRunner.dropForeignKey("social_posts", "FK_SOCIAL_POSTS_POST_ID");
        await queryRunner.dropForeignKey("social_posts", "FK_SOCIAL_POSTS_CHAT_SESSION_ID");
        await queryRunner.dropTable("social_posts");
    }
}