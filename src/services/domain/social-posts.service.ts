import { SocialPost, SocialPlatform, CodeExample, VisualElement } from '../../entities/social-post.entity';
import { ChatSession } from '../../entities/chat-session.entity';
import { SocialPostsRepository } from '../../repositories';
import { logger } from '../../utils/logger';

export interface UpdateSocialPostData {
    content: string;
    image_urls?: string[];
    code_examples?: CodeExample[];
    visual_elements?: VisualElement[];
}

export interface CreateSocialPostData {
    content: string;
    platform: SocialPlatform;
    image_urls?: string[];
    code_examples?: CodeExample[];
    visual_elements?: VisualElement[];
}

export class SocialPostsService {
    /**
     * Get all social posts for a chat session
     */
    async findByChatSession(sessionId: string, userId: string): Promise<SocialPost[]> {
        try {
            return await SocialPostsRepository.findByChatSession(sessionId, userId);
        } catch (error) {
            logger.error(`Error getting social posts for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Get a specific social post by ID
     */
    async findOne(sessionId: string, postId: string, userId: string): Promise<SocialPost | null> {
        try {
            return await SocialPostsRepository.findBySessionAndUser(postId, sessionId, userId);
        } catch (error) {
            logger.error(`Error getting social post ${postId} for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Update a social post content only
     */
    async update(sessionId: string, postId: string, userId: string, data: UpdateSocialPostData): Promise<SocialPost> {
        try {
            const post = await SocialPostsRepository.findBySessionAndUser(postId, sessionId, userId);

            if (!post) {
                throw new Error('Social post not found');
            }

            const updatedPost = await SocialPostsRepository.updateContent(postId, userId, data, post);

            logger.info(`Updated social post ${postId} content`);
            return updatedPost;
        } catch (error) {
            logger.error(`Error updating social post ${postId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a social post by ID only
     */
    async delete(postId: string, userId: string): Promise<void> {
        try {
            const post = await SocialPostsRepository.findByIdAndUser(postId, userId);

            if (!post) {
                throw new Error('Social post not found');
            }

            await SocialPostsRepository.delete({ id: postId, user_id: userId });

            logger.info(`Deleted social post ${postId}`);
        } catch (error) {
            logger.error(`Error deleting social post ${postId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new social post - accepts either session ID or session entity
     */
    async create(sessionId: string, userId: string, postId: string, data: CreateSocialPostData): Promise<SocialPost> {
        try {
            const post = SocialPostsRepository.create({
                chat_session_id: sessionId,
                user_id: userId,
                content: data.content,
                platform: data.platform,
                image_urls: data.image_urls || [],
                code_examples: data.code_examples || [],
                visual_elements: data.visual_elements || [],
                post_id: postId,
            });

            return await SocialPostsRepository.save(post);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Upsert a social post - update if exists for session/platform, create if not
     */
    async upsert(sessionOrId: string | ChatSession, userId: string, data: CreateSocialPostData): Promise<SocialPost> {
        try {
            const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
            const postId = typeof sessionOrId === 'string' ? undefined : sessionOrId.post_id;

            await SocialPostsRepository.upsert(
                {
                    chat_session_id: sessionId,
                    user_id: userId,
                    content: data.content,
                    platform: data.platform,
                    image_urls: data.image_urls || [],
                    code_examples: data.code_examples || [],
                    visual_elements: data.visual_elements || [],
                    post_id: postId,
                },
                ['chat_session_id', 'platform']
            );

            const upsertedPost = await SocialPostsRepository.findBySessionAndPlatform(sessionId, userId, data.platform);

            logger.info(`Upserted social post for session ${sessionId} on platform ${data.platform}`);
            return upsertedPost!;
        } catch (error) {
            logger.error(`Error upserting social post for session:`, error);
            throw error;
        }
    }
}
