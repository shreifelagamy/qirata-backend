import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { CreateChatSessionDto } from '../dtos/chat-session.dto';
import { ChatSession } from '../entities/chat-session.entity';
import { Post } from '../entities/post.entity';
import { ChatSessionRepository } from '../repositories';
import { AIContext } from '../types/ai.types';
import { logger } from '../utils/logger';
import { MessagesService } from './messages.service';
import { SocialPostsService } from './social-posts.service';

export class ChatSessionService {
    private readonly postRepository: Repository<Post>;
    private readonly messagesService: MessagesService;
    private readonly socialPostsService: SocialPostsService;
    private sessionCache = new Map<string, {
        chatSession: ChatSession,
        cacheAt: Date
    }>();

    constructor() {
        this.postRepository = AppDataSource.getRepository(Post);
        this.messagesService = new MessagesService();
        this.socialPostsService = new SocialPostsService();
    }

    async find(userId: string, page = 1, pageSize = 10, query?: string, favoriteFilter?: 'all' | 'favorites' | 'regular') {
        const offset = (page - 1) * pageSize;

        let queryBuilder = ChatSessionRepository
            .createQueryBuilder('session')
            .leftJoinAndSelect('session.post', 'post')
            .where('session.user_id = :userId', { userId })
            .orderBy('session.created_at', 'DESC')
            .skip(offset)
            .take(pageSize);

        // Build additional where conditions
        const conditions = ['session.user_id = :userId'];
        const parameters: any = { userId };

        // Add search query condition
        if (query && query.trim()) {
            const searchTerm = `%${query.trim()}%`;
            conditions.push('(session.title ILIKE :searchTerm OR post.title ILIKE :searchTerm)');
            parameters.searchTerm = searchTerm;
        }

        // Add favorite filter condition
        if (favoriteFilter && favoriteFilter !== 'all') {
            if (favoriteFilter === 'favorites') {
                conditions.push('session.is_favorite = :isFavorite');
                parameters.isFavorite = true;
            } else if (favoriteFilter === 'regular') {
                conditions.push('session.is_favorite = :isFavorite');
                parameters.isFavorite = false;
            }
        }

        // Apply conditions
        queryBuilder = queryBuilder.where(conditions.join(' AND '), parameters);

        const [sessions, total] = await queryBuilder.getManyAndCount();
        const totalPages = Math.ceil(total / pageSize);

        return {
            data: {
                items: sessions,
                total,
                page,
                pageSize,
                totalPages
            },
            status: 200
        };
    }

    async getById(id: string, userId: string) {
        return ChatSessionRepository.findById(id, userId);
    }

    /**
     * Check if a chat session exists
     * @param id - The session ID to check
     * @returns Promise<boolean> - True if session exists, false otherwise
     */
    async exists(id: string, userId: string): Promise<boolean> {
        try {
            return ChatSessionRepository.existsForUser(id, userId);
        } catch (error) {
            logger.error(`Error checking if session ${id} exists:`, error);
            return false;
        }
    }

    async getByPostId(postId: string, userId: string) {
        return ChatSessionRepository.findByPostId(postId, userId);
    }

    async create(dto: CreateChatSessionDto, userId: string) {
        let post = undefined;
        if (dto.postId) {
            // Post no longer has user_id - just check if it exists
            // User access is controlled via user_feeds now
            post = await this.postRepository.findOne({ where: { id: dto.postId } });
            if (!post) throw new Error('Post not found');
        }
        const session = ChatSessionRepository.create({
            title: dto.title,
            user_id: userId,
            post,
        });
        await ChatSessionRepository.save(session);
        return this.getById(session.id, userId);
    }

    private isCacheValid(cacheAt: Date): boolean {
        const CACHE_TTL_MS = 3600000; // 1 hour in milliseconds
        return (new Date().getTime() - cacheAt.getTime()) < CACHE_TTL_MS;
    }

    private async getCachedSession(sessionId: string, userId: string): Promise<ChatSession | null> {
        const cached = this.sessionCache.get(sessionId);

        // Check if cached session is still valid (1 hour TTL)
        if (cached && this.isCacheValid(cached.cacheAt)) {
            logger.debug(`Returning cached session for ${sessionId}`);
            return cached.chatSession;
        }

        const session = await ChatSessionRepository.findWithPost(sessionId, userId);

        if (session) {
            this.sessionCache.set(sessionId, {
                chatSession: session,
                cacheAt: new Date()
            });
            logger.debug(`Cached session for ${sessionId}`);
        }

        return session || null;
    }

    /**
     * Build AI context for chat session
     * @param sessionId - The session ID
     * @param userId - The user ID
     * @param userPreferences - Optional user preferences
     * @returns Promise<AIContext> - Context for AI processing
     */
    async buildAIContext(sessionId: string, userId: string): Promise<AIContext> {
        const session = await this.getCachedSession(sessionId, userId);
        const messages = await this.messagesService.getRecentMessages(sessionId, userId, 10);
        const totalMessageCount = await this.messagesService.getTotalMessageCount(sessionId, userId);
        const socialPosts = await this.socialPostsService.findByChatSession(sessionId, userId);

        return {
            postContent: session?.post?.expanded?.content,
            postSummary: session?.post?.expanded?.summary,
            previousMessages: messages.reverse(),
            totalMessageCount: totalMessageCount,
            socialPosts: socialPosts.map(post => ({
                platform: post.platform,
                content: post.content,
                id: post.id,
                createdAt: post.created_at,
                publishedAt: post.published_at
            })),
            conversationSummary: session?.summary,
        };
    }


    /**
     * Update the chat session summary and last summary timestamp
     */
    async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
        try {
            await ChatSessionRepository.updateSummary(sessionId, summary);

            // Update cache for this session if it exists
            const cached = this.sessionCache.get(sessionId);
            if (cached) {
                cached.chatSession.summary = summary;
                cached.chatSession.last_summary_at = new Date();
                cached.cacheAt = new Date(); // Refresh cache timestamp
            }

            logger.info(`Updated summary for session ${sessionId}`);
        } catch (error) {
            logger.error(`Error updating summary for session ${sessionId}:`, error);
        }
    }

    /**
     * Map voice preference to tone for AI context
     */
    private mapVoiceToTone(voice?: string): string {
        const voiceMap: Record<string, string> = {
            professional: 'professional',
            friendly: 'warm',
            direct: 'concise',
            storyteller: 'narrative'
        };

        return voiceMap[voice || 'friendly'] || 'professional';
    }

    /**
     * Asynchronously extract patterns (fire and forget)
     */
    private async extractPatternsAsync(
        userId: string,
        context: {
            userMessage: string;
            aiResponse: string;
            sessionId: string;
            platform?: string;
            timestamp: Date;
        }
    ): Promise<void> {
        try {
            // await patternExtractionService.analyzeMessage(userId, context);
        } catch (error) {
            // Log but don't throw - this is a background task
            logger.error(`Error extracting patterns for user ${userId}:`, error);
        }
    }

    /**
     * Toggle the favorite status of a chat session
     * @param id - The session ID to toggle
     * @returns Promise<ChatSession | null> - The updated session or null if not found
     */
    async toggleFavorite(id: string, userId: string): Promise<ChatSession | null> {
        try {
            const session = await ChatSessionRepository.toggleFavorite(id, userId);

            if (!session) {
                return null;
            }

            // Update cache if it exists
            const cached = this.sessionCache.get(id);
            if (cached) {
                cached.chatSession.is_favorite = session.is_favorite;
                cached.cacheAt = new Date(); // Refresh cache timestamp
            }

            return session;
        } catch (error) {
            logger.error(`Error toggling favorite status for session ${id}:`, error);
            throw error;
        }
    }

    async isOwner(id: string, userId: string): Promise<boolean> {
        try {
            return ChatSessionRepository.existsForUser(id, userId);
        } catch (error) {
            return false;
        }
    }
}
