import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateSettingsTable1683556811000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "settings",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "key",
                        type: "varchar",
                        length: "100",
                        isNullable: false,
                        isUnique: true
                    },
                    {
                        name: "value",
                        type: "text",
                        isNullable: true
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

        // Create index on updated_at
        await queryRunner.createIndex(
            "settings",
            new TableIndex({
                name: "IDX_SETTINGS_UPDATED_AT",
                columnNames: ["updated_at"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("settings", "IDX_SETTINGS_UPDATED_AT");
        await queryRunner.dropTable("settings");
    }
}