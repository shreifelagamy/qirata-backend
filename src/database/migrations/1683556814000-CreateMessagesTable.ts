import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateMessagesTable1683556814000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "messages",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "chat_session_id",
                        type: "uuid",
                        isNullable: false
                    },
                    {
                        name: "user_message",
                        type: "text",
                        isNullable: false
                    },
                    {
                        name: "ai_response",
                        type: "text",
                        isNullable: false
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

        // Add foreign key constraint with cascade delete
        await queryRunner.createForeignKey(
            "messages",
            new TableForeignKey({
                name: "FK_MESSAGES_CHAT_SESSION_ID",
                columnNames: ["chat_session_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "chat_sessions",
                onDelete: "CASCADE"
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("messages", "FK_MESSAGES_CHAT_SESSION_ID");
        await queryRunner.dropTable("messages");
    }
}