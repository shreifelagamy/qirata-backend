import { MigrationInterface, QueryRunner } from "typeorm";

export class DropLinksTable1735593800000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Dropping links table...");

        // Drop the links table (data was already migrated to feeds/user_feeds)
        await queryRunner.query(`DROP TABLE IF EXISTS links CASCADE;`);

        console.log("Links table dropped successfully!");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Recreating links table...");

        // Recreate the links table structure (without data)
        await queryRunner.query(`
            CREATE TABLE links (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                url VARCHAR(2000) NOT NULL,
                name VARCHAR(255) NOT NULL,
                rss_url VARCHAR(2000),
                is_rss BOOLEAN DEFAULT false,
                favicon_url VARCHAR(2000),
                last_fetch_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_links_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
                CONSTRAINT UQ_links_rss_url_user_id UNIQUE (rss_url, user_id)
            );
        `);

        // Create index
        await queryRunner.query(`CREATE INDEX idx_links_user_id ON links(user_id);`);

        console.log("Links table recreated (without data).");
    }
}
