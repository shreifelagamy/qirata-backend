import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreatePostExpandedTable1683556812000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "post_expanded",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "post_id",
                        type: "uuid",
                        isNullable: false
                    },
                    {
                        name: "content",
                        type: "text",
                        isNullable: false
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP"
                    },
                    {
                        name: "updated_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP"
                    }
                ]
            }),
            true
        );

        // Add foreign key constraint with cascade delete
        await queryRunner.createForeignKey(
            "post_expanded",
            new TableForeignKey({
                name: "FK_POST_EXPANDED_POST_ID",
                columnNames: ["post_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "posts",
                onDelete: "CASCADE"
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("post_expanded", "FK_POST_EXPANDED_POST_ID");
        await queryRunner.dropTable("post_expanded");
    }
}