import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { CreateChatSessionDto } from '../dtos/chat-session.dto';
import { ChatSession } from '../entities/chat-session.entity';
import { Message } from '../entities/message.entity';
import { Post } from '../entities/post.entity';
import { SocialPlatform, SocialPost } from '../entities/social-post.entity';
import { AIContext } from '../types/ai.types';
import { logger } from '../utils/logger';

export class ChatSessionService {
    private readonly chatSessionRepository: Repository<ChatSession>;
    private readonly postRepository: Repository<Post>;
    private readonly messageRepository: Repository<Message>;
    private readonly socialPostRepository: Repository<SocialPost>;
    private sessionCache = new Map<string, {
        chatSession: ChatSession,
        cacheAt: Date
    }>();

    constructor() {
        this.chatSessionRepository = AppDataSource.getRepository(ChatSession);
        this.postRepository = AppDataSource.getRepository(Post);
        this.messageRepository = AppDataSource.getRepository(Message);
        this.socialPostRepository = AppDataSource.getRepository(SocialPost); // Assuming SocialPost is registered in the data source
    }

    async findAll(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [sessions, total] = await this.chatSessionRepository.findAndCount({
            relations: ['post'],
            order: { created_at: 'DESC' },
            skip: offset,
            take: pageSize,
        });

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

    async findOne(id: string) {
        return this.chatSessionRepository.findOne({
            where: { id },
            relations: ['post', 'post.expanded'],
        });
    }

    /**
     * Check if a chat session exists
     * @param id - The session ID to check
     * @returns Promise<boolean> - True if session exists, false otherwise
     */
    async exists(id: string): Promise<boolean> {
        try {
            const count = await this.chatSessionRepository.count({
                where: { id }
            });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking if session ${id} exists:`, error);
            return false;
        }
    }

    async findByPostId(postId: string) {
        return this.chatSessionRepository.findOne({
            where: { post_id: postId },
            relations: ['post'],
        });
    }

    async create(dto: CreateChatSessionDto) {
        let post = undefined;
        if (dto.postId) {
            post = await this.postRepository.findOne({ where: { id: dto.postId } });
            if (!post) throw new Error('Post not found');
        }
        const session = this.chatSessionRepository.create({
            title: dto.title,
            post,
        });
        await this.chatSessionRepository.save(session);
        return this.findOne(session.id);
    }

    private isCacheValid(cacheAt: Date): boolean {
        const CACHE_TTL_MS = 3600000; // 1 hour in milliseconds
        return (new Date().getTime() - cacheAt.getTime()) < CACHE_TTL_MS;
    }

    private async getCachedSession(sessionId: string): Promise<ChatSession | null> {
        const cached = this.sessionCache.get(sessionId);

        // Check if cached session is still valid (1 hour TTL)
        if (cached && this.isCacheValid(cached.cacheAt)) {
            logger.debug(`Returning cached session for ${sessionId}`);
            return cached.chatSession;
        }

        const session = await this.chatSessionRepository.findOne({
            where: { id: sessionId },
            relations: ['post', 'post.expanded'],
        });

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
     * @param userPreferences - Optional user preferences
     * @returns Promise<AIContext> - Context for AI processing
     */
    async buildAIContext(sessionId: string, userPreferences?: any): Promise<AIContext> {
        const session = await this.getCachedSession(sessionId);
        const messages = await this.getRecentMessages(sessionId, 10);

        return {
            postContent: session?.post?.expanded?.content,
            postSummary: session?.post?.expanded?.summary,
            previousMessages: messages,
            conversationSummary: session?.summary,
            userPreferences: userPreferences
        };
    }

    /**
     * Save a chat message to the database
     * @param sessionId - The session ID
     * @param userMessage - User's message
     * @param aiResponse - AI's response
     */
    async saveMessage(sessionId: string, userMessage: string, aiResponse: string): Promise<void> {
        try {
            const message = this.messageRepository.create({
                chat_session_id: sessionId,
                user_message: userMessage,
                ai_response: aiResponse
            });
            await this.messageRepository.save(message);

            logger.debug(`Saved message for session ${sessionId}`);
        } catch (error) {
            logger.error(`Error saving message for session ${sessionId}:`, error);
            throw error;
        }
    }

    async getMessages(sessionId: string, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;
        const [messages, total] = await this.messageRepository.findAndCount({
            where: { chat_session_id: sessionId },
            order: { created_at: 'ASC' },
            skip: offset,
            take: pageSize,
        });

        const totalPages = Math.ceil(total / pageSize);

        return {
            data: {
                items: messages,
                total,
                page,
                pageSize,
                totalPages
            },
            status: 200
        };
    }

    private async getRecentMessages(sessionId: string, limit = 5): Promise<Message[]> {
        try {
            const messages = await this.messageRepository.find({
                where: { chat_session_id: sessionId },
                order: { created_at: 'DESC' },
                take: limit
            });

            // Format as conversation pairs for context
            return messages;
        } catch (error) {
            logger.error(`Error getting recent messages for session ${sessionId}:`, error);
            return [];
        }
    }

    /**
     * Update the chat session summary and last summary timestamp
     */
    async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
        try {
            await this.chatSessionRepository.update(
                { id: sessionId },
                {
                    summary: summary,
                    last_summary_at: new Date()
                }
            );

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

    async saveSocialPost(
        sessionId: string,
        socialPostdata: {
            platform: SocialPlatform;
            content: string;
            imageUrls?: string[];
            publishedAt?: Date;
        }
    ) {
        try {
            const session = await this.getCachedSession(sessionId);
            if (!session) throw new Error('Chat session not found');

            const socialPost = this.socialPostRepository.upsert({
                platform: socialPostdata.platform,
                content: socialPostdata.content,
                chat_session_id: sessionId,
            }, ['chat_session_id', 'platform']);

            logger.info(`Saved social post for session ${sessionId} on platform ${socialPostdata.platform}`);
            return socialPost;
        } catch (error) {
            logger.error(`Error saving social post for session ${sessionId}:`, error);
            throw error;
        }
    }
}
