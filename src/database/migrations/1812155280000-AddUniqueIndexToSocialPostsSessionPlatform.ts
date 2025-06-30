import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddUniqueIndexToSocialPostsSessionPlatform1812155280000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createIndex(
            "social_posts",
            new TableIndex({
                name: "UQ_SOCIAL_POSTS_SESSION_PLATFORM",
                columnNames: ["chat_session_id", "platform"],
                isUnique: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("social_posts", "UQ_SOCIAL_POSTS_SESSION_PLATFORM");
    }
}