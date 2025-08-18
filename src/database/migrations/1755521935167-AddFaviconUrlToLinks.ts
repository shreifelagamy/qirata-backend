import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddFaviconUrlToLinks1755521935167 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("links", new TableColumn({
            name: "favicon_url",
            type: "varchar",
            length: "2000",
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("links", "favicon_url");
    }

}
