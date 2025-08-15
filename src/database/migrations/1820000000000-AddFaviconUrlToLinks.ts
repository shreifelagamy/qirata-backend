import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddFaviconUrlToLinks1820000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add favicon_url column
        await queryRunner.addColumn(
            "links",
            new TableColumn({
                name: "favicon_url",
                type: "varchar",
                length: "2000",
                isNullable: true,
            })
        );

        // Add index on favicon_url for performance
        await queryRunner.createIndex(
            "links",
            new TableIndex({ name: "IDX_links_favicon_url", columnNames: ["favicon_url"] })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.dropIndex("links", "IDX_links_favicon_url");

        // Drop column
        await queryRunner.dropColumn("links", "favicon_url");
    }
}