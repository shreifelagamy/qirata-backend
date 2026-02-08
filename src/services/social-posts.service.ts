import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { SocialPost, SocialPlatform, CodeExample, VisualElement } from '../entities/social-post.entity';
import { ChatSession } from '../entities/chat-session.entity';
import { logger } from '../utils/logger';

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
    private socialPostRepository: Repository<SocialPost>;

    constructor() {
        this.socialPostRepository = AppDataSource.getRepository(SocialPost);
    }

    /**
     * Get all social posts for a chat session
     */
    async findByChatSession(sessionId: string, userId: string): Promise<SocialPost[]> {
        try {
            const posts = await this.socialPostRepository.find({
                where: { chat_session_id: sessionId, user_id: userId },
                order: { created_at: 'DESC' },
            });

            return posts;
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
            const post = await this.socialPostRepository.findOne({
                where: {
                    id: postId,
                    chat_session_id: sessionId,
                    user_id: userId
                }
            });

            return post;
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
            // Find the post first
            const post = await this.socialPostRepository.findOne({
                where: {
                    id: postId,
                    chat_session_id: sessionId,
                    user_id: userId
                }
            });

            if (!post) {
                throw new Error('Social post not found');
            }

            // Update content, image_urls, and structured fields
            await this.socialPostRepository.update(
                { id: postId, user_id: userId },
                {
                    content: data.content,
                    image_urls: data.image_urls || post.image_urls,
                    code_examples: data.code_examples || post.code_examples,
                    visual_elements: data.visual_elements || post.visual_elements
                }
            );

            // Return the updated post
            const updatedPost = await this.socialPostRepository.findOne({
                where: { id: postId, user_id: userId }
            });

            logger.info(`Updated social post ${postId} content`);
            return updatedPost!;
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
            // Find the post first
            const post = await this.socialPostRepository.findOne({
                where: { id: postId, user_id: userId }
            });

            if (!post) {
                throw new Error('Social post not found');
            }

            // Delete the post
            await this.socialPostRepository.delete({ id: postId, user_id: userId });

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
            // Create the post
            const post = this.socialPostRepository.create({
                chat_session_id: sessionId,
                user_id: userId,
                content: data.content,
                platform: data.platform,
                image_urls: data.image_urls || [],
                code_examples: data.code_examples || [],
                visual_elements: data.visual_elements || [],
                post_id: postId
            });

            const savedPost = await this.socialPostRepository.save(post);

            return savedPost;
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

            // Use TypeORM's upsert method with unique constraint
            const result = await this.socialPostRepository.upsert({
                chat_session_id: sessionId,
                user_id: userId,
                content: data.content,
                platform: data.platform,
                image_urls: data.image_urls || [],
                code_examples: data.code_examples || [],
                visual_elements: data.visual_elements || [],
                post_id: postId
            }, ['chat_session_id', 'platform']);

            // Get the upserted post
            const upsertedPost = await this.socialPostRepository.findOne({
                where: {
                    chat_session_id: sessionId,
                    user_id: userId,
                    platform: data.platform
                }
            });

            logger.info(`Upserted social post for session ${sessionId} on platform ${data.platform}`);
            return upsertedPost!;
        } catch (error) {
            logger.error(`Error upserting social post for session:`, error);
            throw error;
        }
    }
}