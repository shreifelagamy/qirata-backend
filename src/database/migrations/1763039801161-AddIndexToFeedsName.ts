import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddIndexToFeedsName1763039801161 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createIndex(
            "feeds",
            new TableIndex({
                name: "idx_feeds_name",
                columnNames: ["name"],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("feeds", "idx_feeds_name");
    }

}
