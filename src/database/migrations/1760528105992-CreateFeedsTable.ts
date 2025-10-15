import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateFeedsTable1760528105992 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "feeds",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "gen_random_uuid()",
                    },
                    {
                        name: "url",
                        type: "varchar",
                        length: "2000",
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: "name",
                        type: "varchar",
                        length: "255",
                        isNullable: false,
                    },
                    {
                        name: "favicon_url",
                        type: "varchar",
                        length: "2000",
                        isNullable: true,
                    },
                    {
                        name: "last_fetch_at",
                        type: "timestamp with time zone",
                        isNullable: true,
                    },
                    {
                        name: "last_modified",
                        type: "timestamp with time zone",
                        isNullable: true,
                    },
                    {
                        name: "etag",
                        type: "varchar",
                        length: "255",
                        isNullable: true,
                    },
                    {
                        name: "fetch_error_count",
                        type: "integer",
                        default: 0,
                    },
                    {
                        name: "status",
                        type: "varchar",
                        length: "20",
                        default: "'active'",
                    },
                    {
                        name: "subscriber_count",
                        type: "integer",
                        default: 0,
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            "feeds",
            new TableIndex({
                name: "idx_feeds_url",
                columnNames: ["url"],
            })
        );

        await queryRunner.createIndex(
            "feeds",
            new TableIndex({
                name: "idx_feeds_last_fetch",
                columnNames: ["last_fetch_at"],
            })
        );

        await queryRunner.createIndex(
            "feeds",
            new TableIndex({
                name: "idx_feeds_status",
                columnNames: ["status"],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("feeds");
    }

}
