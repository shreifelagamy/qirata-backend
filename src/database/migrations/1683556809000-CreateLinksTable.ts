import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateLinksTable1683556809000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "links",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "name",
                        type: "varchar",
                        length: "100",
                        isNullable: false
                    },
                    {
                        name: "url",
                        type: "varchar",
                        length: "2000",
                        isNullable: false,
                        isUnique: false
                    },
                    {
                        name: "created_at",
                        type: "timestamp with time zone",
                        default: "CURRENT_TIMESTAMP"
                    },
                    {
                        name: "is_rss",
                        type: "boolean",
                        default: false
                    },
                    {
                        name: "rss_url",
                        type: "varchar",
                        length: "2000",
                        isNullable: false,
                        isUnique: true
                    }
                ]
            }),
            true
        );

        // Enable uuid-ossp extension for UUID generation
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("links");
    }
}