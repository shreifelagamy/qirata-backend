import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAdminPluginColumns1778075637149 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("user", [
            new TableColumn({ name: "role", type: "text", isNullable: true, default: "'user'" }),
            new TableColumn({ name: "banned", type: "boolean", isNullable: true, default: false }),
            new TableColumn({ name: "banReason", type: "text", isNullable: true }),
            new TableColumn({ name: "banExpires", type: "timestamptz", isNullable: true }),
        ]);

        await queryRunner.addColumn("session", new TableColumn({
            name: "impersonatedBy",
            type: "text",
            isNullable: true,
        }));

        await queryRunner.query(
            `UPDATE "user" SET "role" = 'admin' WHERE "email" = $1`,
            ["theshreif@gmail.com"],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("session", "impersonatedBy");
        await queryRunner.dropColumns("user", ["banExpires", "banReason", "banned", "role"]);
    }
}
