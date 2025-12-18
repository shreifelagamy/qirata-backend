import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class RemoveUserSpecificFieldsFromPosts1760528190000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Removing user-specific fields from posts table...");

        // Drop the read_at index first
        console.log("Dropping IDX_POSTS_READ_AT index...");
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_POSTS_READ_AT";`);

        // Remove the source column (feed name is now in feeds.name via feed_id)
        console.log("Removing source column...");
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "source";`);

        // Remove the read_at column (now stored in user_posts.read_at)
        console.log("Removing read_at column...");
        await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "read_at";`);

        console.log("User-specific fields removed successfully!");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Restoring user-specific fields to posts table...");

        // Add back read_at column
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "read_at",
                type: "timestamp with time zone",
                isNullable: true,
            })
        );

        // Add back source column
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "source",
                type: "varchar",
                length: "255",
                isNullable: false,
                default: "''",
            })
        );

        // Recreate the read_at index
        await queryRunner.query(`
            CREATE INDEX "IDX_POSTS_READ_AT" ON posts (read_at);
        `);

        // Attempt to restore data from user_posts and feeds (best effort)
        console.log("Attempting to restore data from user_posts and feeds...");

        // Restore source from feed name
        await queryRunner.query(`
            UPDATE posts p
            SET source = f.name
            FROM feeds f
            WHERE p.feed_id = f.id;
        `);

        // Restore read_at for the post owner (first user who read it)
        await queryRunner.query(`
            UPDATE posts p
            SET read_at = up.read_at
            FROM user_posts up
            WHERE p.id = up.post_id
            AND p.user_id = up.user_id;
        `);

        console.log("Rollback completed. Note: This is best-effort restoration.");
    }

}
