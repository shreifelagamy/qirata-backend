import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddLastFetchAtToLinks1810897738000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "links",
            new TableColumn({
                name: "last_fetch_at",
                type: "timestamp",
                isNullable: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("links", "last_fetch_at");
    }
}