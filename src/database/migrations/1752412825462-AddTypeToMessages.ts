import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTypeToMessages1752412825462 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add type column to distinguish between regular messages and social posts
        await queryRunner.addColumn("messages", new TableColumn({
            name: "type",
            type: "varchar",
            length: "20",
            default: "'message'",
            isNullable: false
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("messages", "type");
    }

}
