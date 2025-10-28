import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class RemoveUserIdFromPosts1760542977114 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Removing user_id from posts table...");

        // Drop index first
        console.log("Dropping index IDX_posts_user_id...");
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_user_id"`);

        // Drop the user_id column (this will also drop any foreign key constraints)
        console.log("Dropping user_id column...");
        await queryRunner.dropColumn("posts", "user_id");

        console.log("user_id removed successfully from posts table!");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Restoring user_id to posts table...");

        // Add back user_id column
        await queryRunner.addColumn(
            "posts",
            new TableColumn({
                name: "user_id",
                type: "varchar",
                isNullable: false,
            })
        );

        // Recreate foreign key
        await queryRunner.createForeignKey(
            "posts",
            new TableForeignKey({
                name: "fk_posts_user",
                columnNames: ["user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        console.log("user_id restored to posts table!");
    }

}
