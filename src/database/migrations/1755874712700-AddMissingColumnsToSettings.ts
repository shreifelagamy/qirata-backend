import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddMissingColumnsToSettings1755874712700 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add created_at column
        await queryRunner.addColumn("settings", new TableColumn({
            name: "created_at",
            type: "timestamp with time zone",
            default: "CURRENT_TIMESTAMP"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop created_at column
        await queryRunner.dropColumn("settings", "created_at");
    }

}
