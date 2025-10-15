import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class CreateCategoriesTable1760528173235 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "categories",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "gen_random_uuid()",
                    },
                    {
                        name: "user_id",
                        type: "varchar",
                        isNullable: false,
                    },
                    {
                        name: "name",
                        type: "varchar",
                        length: "100",
                        isNullable: false,
                    },
                    {
                        name: "parent_id",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            "categories",
            new TableIndex({
                name: "idx_categories_user",
                columnNames: ["user_id"],
            })
        );

        await queryRunner.createIndex(
            "categories",
            new TableIndex({
                name: "idx_categories_parent",
                columnNames: ["user_id", "parent_id"],
            })
        );

        // Create unique constraint
        await queryRunner.createIndex(
            "categories",
            new TableIndex({
                name: "uq_categories_user_name_parent",
                columnNames: ["user_id", "name", "parent_id"],
                isUnique: true,
            })
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            "categories",
            new TableForeignKey({
                name: "fk_categories_user",
                columnNames: ["user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );

        await queryRunner.createForeignKey(
            "categories",
            new TableForeignKey({
                name: "fk_categories_parent",
                columnNames: ["parent_id"],
                referencedTableName: "categories",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE",
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("categories", "fk_categories_parent");
        await queryRunner.dropForeignKey("categories", "fk_categories_user");
        await queryRunner.dropTable("categories");
    }

}
