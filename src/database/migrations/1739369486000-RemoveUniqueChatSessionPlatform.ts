import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class RemoveUniqueChatSessionPlatform1739369486000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the unique constraint on chat_session_id and platform
        await queryRunner.dropIndex("social_posts", "UQ_SOCIAL_POSTS_SESSION_PLATFORM");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the unique constraint
        await queryRunner.createIndex(
            "social_posts",
            new TableIndex({
                name: "UQ_SOCIAL_POSTS_SESSION_PLATFORM",
                columnNames: ["chat_session_id", "platform"],
                isUnique: true
            })
        );
    }
}
