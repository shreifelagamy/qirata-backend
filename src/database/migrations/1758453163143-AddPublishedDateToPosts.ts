import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPublishedDateToPosts1758453163143 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "published_date",
                type: "timestamp with time zone",
                isNullable: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("posts", "published_date");
    }

}
