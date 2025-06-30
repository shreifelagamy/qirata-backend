import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateChatSessionsTable1683556813000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "chat_sessions",
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
                        name: "post_id",
                        type: "uuid",
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

        // Add foreign key constraint
        await queryRunner.createForeignKey(
            "chat_sessions",
            new TableForeignKey({
                name: "FK_CHAT_SESSIONS_POST_ID",
                columnNames: ["post_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "posts",
                onDelete: "SET NULL"
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("chat_sessions", "FK_CHAT_SESSIONS_POST_ID");
        await queryRunner.dropTable("chat_sessions");
    }
}