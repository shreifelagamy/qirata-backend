import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreatePostsTable1683556810000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "posts",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "title",
                        type: "varchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "content",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "image_url",
                        type: "varchar",
                        length: "2000",
                        isNullable: true
                    },
                    {
                        name: "external_link",
                        type: "varchar",
                        length: "2000",
                        isNullable: false
                    },
                    {
                        name: "source",
                        type: "varchar",
                        length: "255",
                        isNullable: false
                    },
                    {
                        name: "read_at",
                        type: "timestamp with time zone",
                        isNullable: true
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP"
                    }
                ]
            }),
            true
        );

        // Create index on read_at
        await queryRunner.createIndex(
            "posts",
            new TableIndex({
                name: "IDX_POSTS_READ_AT",
                columnNames: ["read_at"]
            })
        );

        // Create index on created_at
        await queryRunner.createIndex(
            "posts",
            new TableIndex({
                name: "IDX_POSTS_CREATED_AT",
                columnNames: ["created_at"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("posts", "IDX_POSTS_READ_AT");
        await queryRunner.dropIndex("posts", "IDX_POSTS_CREATED_AT");
        await queryRunner.dropTable("posts");
    }
}