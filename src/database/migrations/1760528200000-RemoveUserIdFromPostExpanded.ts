import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUserIdFromPostExpanded1760528200000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Removing user_id from post_expanded table to make it global...");

        // Drop the foreign key constraint first
        console.log("Dropping foreign key constraint FK_post_expanded_user...");
        await queryRunner.query(`
            ALTER TABLE post_expanded
            DROP CONSTRAINT IF EXISTS "FK_post_expanded_user";
        `);

        // Drop the index on user_id if it exists
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_post_expanded_user_id";
        `);

        // Drop the user_id column
        console.log("Removing user_id column...");
        await queryRunner.query(`
            ALTER TABLE post_expanded
            DROP COLUMN IF EXISTS user_id;
        `);

        console.log("post_expanded is now global - user_id removed successfully!");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Restoring user_id to post_expanded table...");

        // Add back user_id column (nullable initially for migration)
        await queryRunner.query(`
            ALTER TABLE post_expanded
            ADD COLUMN user_id varchar NULL;
        `);

        // Best effort: Try to populate user_id from associated posts
        console.log("Attempting to restore user_id data from posts...");
        await queryRunner.query(`
            UPDATE post_expanded pe
            SET user_id = p.user_id
            FROM posts p
            WHERE pe.post_id = p.id;
        `);

        // Make user_id NOT NULL after data restoration
        await queryRunner.query(`
            ALTER TABLE post_expanded
            ALTER COLUMN user_id SET NOT NULL;
        `);

        // Recreate the index
        await queryRunner.query(`
            CREATE INDEX "IDX_post_expanded_user_id" ON post_expanded (user_id);
        `);

        // Recreate the foreign key
        await queryRunner.query(`
            ALTER TABLE post_expanded
            ADD CONSTRAINT "FK_post_expanded_user"
            FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
        `);

        console.log("Rollback completed. Note: This is best-effort restoration.");
    }

}
