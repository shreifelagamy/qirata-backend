import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { SocialPost, SocialPlatform } from '../entities/social-post.entity';
import { ChatSession } from '../entities/chat-session.entity';
import { logger } from '../utils/logger';

export interface UpdateSocialPostData {
    content: string;
    image_urls?: string[];
}

export interface CreateSocialPostData {
    content: string;
    platform: SocialPlatform;
    image_urls?: string[];
}

export class SocialPostsService {
    private socialPostRepository: Repository<SocialPost>;

    constructor() {
        this.socialPostRepository = AppDataSource.getRepository(SocialPost);
    }

    /**
     * Get all social posts for a chat session
     */
    async findByChatSession(sessionId: string): Promise<SocialPost[]> {
        try {
            const posts = await this.socialPostRepository.find({
                where: { chat_session_id: sessionId },
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
    async findOne(sessionId: string, postId: string): Promise<SocialPost | null> {
        try {
            const post = await this.socialPostRepository.findOne({
                where: { 
                    id: postId,
                    chat_session_id: sessionId
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
    async update(sessionId: string, postId: string, data: UpdateSocialPostData): Promise<SocialPost> {
        try {
            // Find the post first
            const post = await this.socialPostRepository.findOne({
                where: { 
                    id: postId,
                    chat_session_id: sessionId
                }
            });

            if (!post) {
                throw new Error('Social post not found');
            }

            // Update only content and image_urls
            await this.socialPostRepository.update(postId, {
                content: data.content,
                image_urls: data.image_urls || post.image_urls
            });

            // Return the updated post
            const updatedPost = await this.socialPostRepository.findOne({
                where: { id: postId }
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
    async delete(postId: string): Promise<void> {
        try {
            // Find the post first
            const post = await this.socialPostRepository.findOne({
                where: { id: postId }
            });

            if (!post) {
                throw new Error('Social post not found');
            }

            // Delete the post
            await this.socialPostRepository.delete(postId);

            logger.info(`Deleted social post ${postId}`);
        } catch (error) {
            logger.error(`Error deleting social post ${postId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new social post - accepts either session ID or session entity
     */
    async create(sessionOrId: string | ChatSession, data: CreateSocialPostData): Promise<SocialPost> {
        try {
            const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
            const postId = typeof sessionOrId === 'string' ? undefined : sessionOrId.post_id;

            // Create the post
            const post = this.socialPostRepository.create({
                chat_session_id: sessionId,
                content: data.content,
                platform: data.platform,
                image_urls: data.image_urls || [],
                post_id: postId
            });

            const savedPost = await this.socialPostRepository.save(post);

            logger.info(`Created social post ${savedPost.id} for session ${sessionId}`);
            return savedPost;
        } catch (error) {
            logger.error(`Error creating social post for session:`, error);
            throw error;
        }
    }
}