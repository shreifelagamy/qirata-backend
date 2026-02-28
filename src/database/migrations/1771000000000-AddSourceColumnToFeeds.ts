import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSourceColumnToFeeds1771000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "feeds" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'native'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "feeds" DROP COLUMN "source"
        `);
    }
}
