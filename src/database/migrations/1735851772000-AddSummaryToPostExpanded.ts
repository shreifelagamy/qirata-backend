import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSummaryToPostExpanded1735851772000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "post_expanded",
            new TableColumn({
                name: "summary",
                type: "text",
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("post_expanded", "summary");
    }
}