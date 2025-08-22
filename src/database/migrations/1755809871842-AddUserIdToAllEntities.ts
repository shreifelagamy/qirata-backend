import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex, TableUnique } from "typeorm";

export class AddUserIdToAllEntities1755809871842 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = ["chat_sessions", "posts", "links", "messages", "post_expanded", "social_posts", "settings"];

        // Add user_id columns to all tables
        for (const table of tables) {
            await queryRunner.addColumn(table, new TableColumn({
                name: "user_id",
                type: "varchar",
                isNullable: false,
            }));
        }

        // Add foreign key constraints
        for (const table of tables) {
            await queryRunner.createForeignKey(table, new TableForeignKey({
                columnNames: ["user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
                name: `FK_${table}_user`
            }));
        }

        // Drop old unique constraint for settings
        try {
            await queryRunner.dropUniqueConstraint("settings", "UQ_settings_key");
        } catch (error) {
            // Constraint might not exist
        }

        // Add new unique constraint for settings (user_id + key)
        await queryRunner.createUniqueConstraint("settings", new TableUnique({
            columnNames: ["user_id", "key"],
            name: "UQ_settings_user_key"
        }));

        // Create indexes for better performance
        for (const table of tables) {
            await queryRunner.createIndex(table, new TableIndex({
                columnNames: ["user_id"],
                name: `IDX_${table}_user_id`
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = ["chat_sessions", "posts", "links", "messages", "post_expanded", "social_posts", "settings"];

        // Drop indexes
        for (const table of tables) {
            try {
                await queryRunner.dropIndex(table, `IDX_${table}_user_id`);
            } catch (error) {
                // Index might not exist
            }
        }

        // Drop unique constraint for settings
        try {
            await queryRunner.dropUniqueConstraint("settings", "UQ_settings_user_key");
        } catch (error) {
            // Constraint might not exist
        }

        // Drop foreign key constraints
        for (const table of tables) {
            try {
                await queryRunner.dropForeignKey(table, `FK_${table}_user`);
            } catch (error) {
                // Foreign key might not exist
            }
        }

        // Drop user_id columns
        for (const table of tables) {
            try {
                await queryRunner.dropColumn(table, "user_id");
            } catch (error) {
                // Column might not exist
            }
        }

        // Restore original unique constraint for settings
        await queryRunner.createUniqueConstraint("settings", new TableUnique({
            columnNames: ["key"],
            name: "UQ_settings_key"
        }));

    }

}
