import { MigrationInterface, QueryRunner, TableUnique } from "typeorm";

export class UpdateLinksRssUrlUniqueIndex1756237271778 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing unique constraint on rss_url
        await queryRunner.dropUniqueConstraint("links", "UQ_7777f938bf2cdcffa2dd9772e61");
        
        // Create a new composite unique constraint on rss_url + user_id
        await queryRunner.createUniqueConstraint("links", new TableUnique({
            columnNames: ["rss_url", "user_id"],
            name: "UQ_links_rss_url_user_id"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the composite unique constraint
        await queryRunner.dropUniqueConstraint("links", "UQ_links_rss_url_user_id");
        
        // Restore the original unique constraint on rss_url only
        await queryRunner.createUniqueConstraint("links", new TableUnique({
            columnNames: ["rss_url"],
            name: "UQ_7777f938bf2cdcffa2dd9772e61"
        }));
    }

}
