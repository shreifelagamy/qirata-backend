import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddStructuredContentToSocialPosts1752406068240 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add code_examples column - JSONB array of code snippets
        await queryRunner.addColumn("social_posts", new TableColumn({
            name: "code_examples",
            type: "jsonb",
            isNullable: true
        }));

        // Add visual_elements column - JSONB array of visual element descriptions
        await queryRunner.addColumn("social_posts", new TableColumn({
            name: "visual_elements", 
            type: "jsonb",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("social_posts", "visual_elements");
        await queryRunner.dropColumn("social_posts", "code_examples");
    }

}
