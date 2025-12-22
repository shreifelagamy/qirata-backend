import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateFeedFetchLogs1766059098171 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "feed_fetch_logs",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "gen_random_uuid()",
                    },
                    {
                        name: "feed_id",
                        type: "uuid",
                        isNullable: false,
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "fetched_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "status_code",
                        type: "integer",
                        isNullable: true,
                    },
                    {
                        name: "response_time_ms",
                        type: "integer",
                        isNullable: true,
                    },
                    {
                        name: "error_message",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "new_posts_count",
                        type: "integer",
                        default: 0,
                    },
                    {
                        name: "was_modified",
                        type: "boolean",
                        default: true,
                    },
                ],
            }),
            true
        );

        // Create foreign key to feeds table
        await queryRunner.createForeignKey(
            "feed_fetch_logs",
            new TableForeignKey({
                columnNames: ["feed_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "feeds",
                onDelete: "CASCADE",
            })
        );

        // Create index on feed_id and fetched_at for efficient queries
        await queryRunner.createIndex(
            "feed_fetch_logs",
            new TableIndex({
                name: "idx_feed_logs_feed_date",
                columnNames: ["feed_id", "fetched_at"],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("feed_fetch_logs");
    }

}
