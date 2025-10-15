import { MigrationInterface, QueryRunner } from "typeorm";

export class PreparePostExpandedForGlobal1760528174717 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Placeholder migration - documents strategy for post_expanded
        // user_id will be removed in a future migration after data migration
        await queryRunner.query(`
            COMMENT ON TABLE post_expanded IS 'Stores expanded content for posts. Will be migrated to global model (remove user_id) in future migration after data migration complete.';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            COMMENT ON TABLE post_expanded IS NULL;
        `);
    }

}
