import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateDataToGlobalFeeds1760528180000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Starting data migration to global feeds...");

        // Step 1: Extract unique feeds from links table and populate feeds table
        console.log("Step 1/5: Extracting unique feeds from links table...");
        await queryRunner.query(`
            INSERT INTO feeds (id, url, name, favicon_url, last_fetch_at, created_at, updated_at)
            SELECT
                gen_random_uuid() as id,
                rss_url as url,
                MIN(name) as name,
                MIN(favicon_url) as favicon_url,
                MAX(last_fetch_at) as last_fetch_at,
                MIN(created_at) as created_at,
                NOW() as updated_at
            FROM links
            WHERE rss_url IS NOT NULL AND rss_url != ''
            GROUP BY rss_url
            ON CONFLICT (url) DO NOTHING;
        `);

        // Step 2: Create user_feeds subscriptions from links
        console.log("Step 2/5: Creating user feed subscriptions...");
        await queryRunner.query(`
            INSERT INTO user_feeds (id, user_id, feed_id, custom_name, subscribed_at)
            SELECT
                gen_random_uuid() as id,
                l.user_id,
                f.id as feed_id,
                CASE WHEN l.name != f.name THEN l.name ELSE NULL END as custom_name,
                l.created_at as subscribed_at
            FROM links l
            INNER JOIN feeds f ON f.url = l.rss_url
            WHERE l.rss_url IS NOT NULL AND l.rss_url != ''
            ON CONFLICT (user_id, feed_id) DO NOTHING;
        `);

        // Step 3: Link posts to feeds based on source matching
        console.log("Step 3/5: Linking posts to feeds...");
        await queryRunner.query(`
            UPDATE posts p
            SET feed_id = f.id
            FROM feeds f
            WHERE p.source = f.name
            AND p.feed_id IS NULL;
        `);

        // Alternative approach: Try to match by domain if source matching didn't work
        await queryRunner.query(`
            UPDATE posts p
            SET feed_id = (
                SELECT f.id
                FROM feeds f
                WHERE p.external_link LIKE '%' || SPLIT_PART(f.url, '://', 2) || '%'
                LIMIT 1
            )
            WHERE p.feed_id IS NULL
            AND p.external_link IS NOT NULL;
        `);

        // Step 4: Deduplicate posts and migrate read states to user_posts
        console.log("Step 4/5: Deduplicating posts and migrating read states...");

        // First, create user_posts entries for all existing posts with their read states
        await queryRunner.query(`
            INSERT INTO user_posts (id, user_id, post_id, read_at, bookmarked, created_at)
            SELECT
                gen_random_uuid() as id,
                p.user_id,
                p.id as post_id,
                p.read_at,
                false as bookmarked,
                COALESCE(p.read_at, p.created_at) as created_at
            FROM posts p
            ON CONFLICT (user_id, post_id) DO NOTHING;
        `);

        // Find and handle duplicate posts by external_link
        // Keep the oldest post for each external_link and migrate other users' read states

        // First, create a temporary table to track posts to merge
        await queryRunner.query(`
            CREATE TEMP TABLE posts_merge_map AS
            WITH duplicate_posts AS (
                SELECT
                    external_link,
                    array_agg(id ORDER BY created_at ASC) as post_ids,
                    (array_agg(id ORDER BY created_at ASC))[1] as keep_post_id
                FROM posts
                WHERE external_link IS NOT NULL
                GROUP BY external_link
                HAVING COUNT(*) > 1
            )
            SELECT
                unnest(dp.post_ids[2:]) as delete_post_id,
                dp.keep_post_id
            FROM duplicate_posts dp;
        `);

        // Delete user_posts that would conflict after update
        await queryRunner.query(`
            DELETE FROM user_posts up
            WHERE up.id IN (
                SELECT up2.id
                FROM user_posts up2
                INNER JOIN posts_merge_map pmm ON up2.post_id = pmm.delete_post_id
                WHERE EXISTS (
                    SELECT 1 FROM user_posts up3
                    WHERE up3.user_id = up2.user_id
                    AND up3.post_id = pmm.keep_post_id
                )
            );
        `);

        // Update remaining user_posts to point to the kept post
        await queryRunner.query(`
            UPDATE user_posts up
            SET post_id = pmm.keep_post_id
            FROM posts_merge_map pmm
            WHERE up.post_id = pmm.delete_post_id;
        `);

        // Delete duplicate posts (user_posts are now updated to point to kept posts)
        await queryRunner.query(`
            WITH duplicate_posts AS (
                SELECT
                    external_link,
                    array_agg(id ORDER BY created_at ASC) as post_ids
                FROM posts
                WHERE external_link IS NOT NULL
                GROUP BY external_link
                HAVING COUNT(*) > 1
            )
            DELETE FROM posts
            WHERE id IN (
                SELECT unnest(dp.post_ids[2:])
                FROM duplicate_posts dp
            );
        `);

        // Step 5: Consolidate post_expanded (remove duplicates, keep most recent)
        console.log("Step 5/5: Consolidating post_expanded content...");
        await queryRunner.query(`
            WITH duplicate_expanded AS (
                SELECT
                    post_id,
                    array_agg(id ORDER BY updated_at DESC) as expanded_ids
                FROM post_expanded
                GROUP BY post_id
                HAVING COUNT(*) > 1
            )
            DELETE FROM post_expanded
            WHERE id IN (
                SELECT unnest(de.expanded_ids[2:])
                FROM duplicate_expanded de
            );
        `);

        // Update subscriber counts
        console.log("Updating feed subscriber counts...");
        await queryRunner.query(`
            UPDATE feeds f
            SET subscriber_count = (
                SELECT COUNT(*)
                FROM user_feeds uf
                WHERE uf.feed_id = f.id
            );
        `);

        console.log("Data migration completed successfully!");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Reverting data migration...");

        // This is a complex data migration, so rollback is challenging
        // We'll clear the new tables but cannot fully restore duplicated posts
        console.warn("WARNING: This rollback will clear new tables but cannot restore deleted duplicate posts");

        await queryRunner.query(`TRUNCATE user_posts CASCADE;`);
        await queryRunner.query(`TRUNCATE user_feeds CASCADE;`);
        await queryRunner.query(`TRUNCATE categories CASCADE;`);
        await queryRunner.query(`TRUNCATE feeds CASCADE;`);
        await queryRunner.query(`UPDATE posts SET feed_id = NULL;`);

        console.log("Rollback completed. Note: Duplicate posts that were removed cannot be restored.");
    }

}
