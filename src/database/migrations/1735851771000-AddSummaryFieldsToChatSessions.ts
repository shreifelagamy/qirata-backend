import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSummaryFieldsToChatSessions1735851771000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns(
            "chat_sessions",
            [
                new TableColumn({
                    name: "summary",
                    type: "text",
                    isNullable: true,
                }),
                new TableColumn({
                    name: "last_summary_at",
                    type: "timestamp",
                    isNullable: true,
                })
            ]
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns("chat_sessions", ["summary", "last_summary_at"]);
    }
}