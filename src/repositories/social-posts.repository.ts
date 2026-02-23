import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { SocialPost, SocialPlatform, CodeExample, VisualElement } from '../entities/social-post.entity';

export interface SocialPostsRepository extends Repository<SocialPost> {
    findByChatSession(sessionId: string, userId: string): Promise<SocialPost[]>;
    findByIdAndUser(postId: string, userId: string): Promise<SocialPost | null>;
    findBySessionAndUser(postId: string, sessionId: string, userId: string): Promise<SocialPost | null>;
    findBySessionAndPlatform(sessionId: string, userId: string, platform: SocialPlatform): Promise<SocialPost | null>;
    updateContent(postId: string, userId: string, data: { content: string; image_urls?: string[]; code_examples?: CodeExample[]; visual_elements?: VisualElement[] }, existing: SocialPost): Promise<SocialPost>;
}

export const SocialPostsRepository = AppDataSource.getRepository(SocialPost).extend({
    /**
     * Get all social posts for a chat session ordered by creation date
     */
    async findByChatSession(sessionId: string, userId: string): Promise<SocialPost[]> {
        return this.find({
            where: { chat_session_id: sessionId, user_id: userId },
            order: { created_at: 'DESC' },
        });
    },

    /**
     * Find a social post by its ID and user ID
     */
    async findByIdAndUser(postId: string, userId: string): Promise<SocialPost | null> {
        return this.findOne({
            where: { id: postId, user_id: userId },
        });
    },

    /**
     * Find a social post by its ID, session ID, and user ID
     */
    async findBySessionAndUser(postId: string, sessionId: string, userId: string): Promise<SocialPost | null> {
        return this.findOne({
            where: { id: postId, chat_session_id: sessionId, user_id: userId },
        });
    },

    /**
     * Find a social post by session, user, and platform
     */
    async findBySessionAndPlatform(sessionId: string, userId: string, platform: SocialPlatform): Promise<SocialPost | null> {
        return this.findOne({
            where: { chat_session_id: sessionId, user_id: userId, platform },
        });
    },

    /**
     * Update content and structured fields of a social post
     */
    async updateContent(
        postId: string,
        userId: string,
        data: { content: string; image_urls?: string[]; code_examples?: CodeExample[]; visual_elements?: VisualElement[] },
        existing: SocialPost
    ): Promise<SocialPost> {
        await this.update(
            { id: postId, user_id: userId },
            {
                content: data.content,
                image_urls: data.image_urls ?? existing.image_urls,
                code_examples: data.code_examples ?? existing.code_examples,
                visual_elements: data.visual_elements ?? existing.visual_elements,
            }
        );

        return (await this.findOne({ where: { id: postId, user_id: userId } }))!;
    },
});
