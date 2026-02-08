import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class ReplaceMessageTypeWithSocialPostReference1770562132775 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add social_post_id column as a nullable foreign key
        await queryRunner.addColumn("messages", new TableColumn({
            name: "social_post_id",
            type: "uuid",
            isNullable: true,
        }));

        await queryRunner.createForeignKey("messages", new TableForeignKey({
            columnNames: ["social_post_id"],
            referencedTableName: "social_posts",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
        }));

        // Drop the type column
        await queryRunner.dropColumn("messages", "type");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the type column
        await queryRunner.addColumn("messages", new TableColumn({
            name: "type",
            type: "varchar",
            length: "20",
            default: "'message'",
            isNullable: false,
        }));

        // Drop the foreign key and column
        const table = await queryRunner.getTable("messages");
        const foreignKey = table!.foreignKeys.find(fk => fk.columnNames.indexOf("social_post_id") !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey("messages", foreignKey);
        }
        await queryRunner.dropColumn("messages", "social_post_id");
    }

}
