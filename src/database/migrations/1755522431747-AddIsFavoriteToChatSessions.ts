import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddIsFavoriteToChatSessions1755522431747 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("chat_sessions", new TableColumn({
            name: "is_favorite",
            type: "boolean",
            default: false,
            isNullable: false,
        }));

        // Add index for performance when filtering by favorites
        await queryRunner.createIndex("chat_sessions", new TableIndex({
            name: "IDX_CHAT_SESSIONS_IS_FAVORITE",
            columnNames: ["is_favorite"]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("chat_sessions", "IDX_CHAT_SESSIONS_IS_FAVORITE");
        await queryRunner.dropColumn("chat_sessions", "is_favorite");
    }

}
