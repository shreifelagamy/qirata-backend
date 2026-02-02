import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddLastIntentToChatSessions1770062132775 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "chat_sessions",
            new TableColumn({
                name: "last_intent",
                type: "varchar",
                isNullable: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("chat_sessions", "last_intent");
    }

}
