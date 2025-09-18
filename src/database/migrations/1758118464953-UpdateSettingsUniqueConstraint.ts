import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSettingsUniqueConstraint1758118464953 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing unique constraint on 'key' only
        await queryRunner.dropUniqueConstraint("settings", "UQ_c8639b7626fa94ba8265628f214");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the composite unique constraint
        await queryRunner.dropUniqueConstraint("settings", "UQ_settings_user_key");
    }
}
