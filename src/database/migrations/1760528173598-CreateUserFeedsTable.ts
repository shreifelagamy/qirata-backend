import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateUserFeedsTable1760528173598 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "user_feeds",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "gen_random_uuid()",
                    },
                    {
                        name: "user_id",
                        type: "varchar",
                        isNullable: false,
                    },
                    {
                        name: "feed_id",
                        type: "uuid",
                        isNullable: false,
                    },
                    {
                        name: "category_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "custom_name",
                        type: "varchar",
                        length: "255",
                        isNullable: true,
                    },
                    {
                        name: "subscribed_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            "user_feeds",
            new TableIndex({
                name: "idx_user_feeds_user",
                columnNames: ["user_id"],
            })
        );

        await queryRunner.createIndex(
            "user_feeds",
            new TableIndex({
                name: "idx_user_feeds_feed",
                columnNames: ["feed_id"],
            })
        );

        await queryRunner.createIndex(
            "user_feeds",
            new TableIndex({
                name: "idx_user_feeds_category",
                columnNames: ["user_id", "category_id"],
            })
        );

        // Create unique constraint
        await queryRunner.createIndex(
            "user_feeds",
            new TableIndex({
                name: "uq_user_feeds_user_feed",
                columnNames: ["user_id", "feed_id"],
                isUnique: true,
            })
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            "user_feeds",
            new TableForeignKey({
                name: "fk_user_feeds_user",
                columnNames: ["user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "user_feeds",
            new TableForeignKey({
                name: "fk_user_feeds_feed",
                columnNames: ["feed_id"],
                referencedTableName: "feeds",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "user_feeds",
            new TableForeignKey({
                name: "fk_user_feeds_category",
                columnNames: ["category_id"],
                referencedTableName: "categories",
                referencedColumnNames: ["id"],
                onDelete: "SET NULL",
            })
        );

        // Create trigger function
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_feed_subscriber_count()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE feeds SET subscriber_count = subscriber_count + 1 
                    WHERE id = NEW.feed_id;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE feeds SET subscriber_count = subscriber_count - 1 
                    WHERE id = OLD.feed_id;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger
        await queryRunner.query(`
            CREATE TRIGGER feed_subscription_count_trigger
            AFTER INSERT OR DELETE ON user_feeds
            FOR EACH ROW EXECUTE FUNCTION update_feed_subscriber_count();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS feed_subscription_count_trigger ON user_feeds;`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_feed_subscriber_count();`);
        await queryRunner.dropForeignKey("user_feeds", "fk_user_feeds_category");
        await queryRunner.dropForeignKey("user_feeds", "fk_user_feeds_feed");
        await queryRunner.dropForeignKey("user_feeds", "fk_user_feeds_user");
        await queryRunner.dropTable("user_feeds");
    }

}
