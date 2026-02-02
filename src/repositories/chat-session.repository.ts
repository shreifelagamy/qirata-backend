import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { ChatSession } from '../entities/chat-session.entity';

export interface ChatSessionRepository extends Repository<ChatSession> {
    findByUserId(userId: string, page?: number, pageSize?: number): Promise<{ items: ChatSession[]; total: number }>;
    findByPostId(postId: string, userId: string): Promise<ChatSession | null>;
    findById(id: string, userId: string): Promise<ChatSession | null>;
    findWithPost(id: string, userId: string): Promise<ChatSession | null>;
    existsForUser(id: string, userId: string): Promise<boolean>;
    toggleFavorite(id: string, userId: string): Promise<ChatSession | null>;
    updateSummary(id: string, summary: string): Promise<void>;
    updateLastIntent(id: string, intent: string): Promise<void>;
}

export const ChatSessionRepository = AppDataSource.getRepository(ChatSession).extend({
    /**
     * Find chat sessions by user ID with pagination
     */
    async findByUserId(
        userId: string,
        page = 1,
        pageSize = 10
    ): Promise<{ items: ChatSession[]; total: number }> {
        const offset = (page - 1) * pageSize;

        const [items, total] = await this.createQueryBuilder('session')
            .leftJoinAndSelect('session.post', 'post')
            .where('session.user_id = :userId', { userId })
            .orderBy('session.created_at', 'DESC')
            .skip(offset)
            .take(pageSize)
            .getManyAndCount();

        return { items, total };
    },

    /**
     * Find a chat session by post ID and user ID
     */
    async findByPostId(postId: string, userId: string): Promise<ChatSession | null> {
        return this.findOne({
            where: { post_id: postId, user_id: userId },
            relations: ['post'],
        });
    },

    /**
     * Find a chat session by ID and user ID (no relations)
     */
    async findById(id: string, userId: string): Promise<ChatSession | null> {
        return this.findOne({
            where: { id, user_id: userId },
        });
    },

    /**
     * Find a chat session with its related post and expanded content
     */
    async findWithPost(id: string, userId: string): Promise<ChatSession | null> {
        return this.findOne({
            where: { id, user_id: userId },
            relations: ['post', 'post.expanded'],
        });
    },

    /**
     * Check if a chat session exists for a specific user
     */
    async existsForUser(id: string, userId: string): Promise<boolean> {
        const count = await this.count({
            where: { id, user_id: userId }
        });
        return count > 0;
    },

    /**
     * Toggle the favorite status of a chat session
     */
    async toggleFavorite(id: string, userId: string): Promise<ChatSession | null> {
        const session = await this.findOne({
            where: { id, user_id: userId },
            relations: ['post']
        });

        if (!session) {
            return null;
        }

        const updatedIsFavorite = !session.is_favorite;

        await this.update(
            { id, user_id: userId },
            { is_favorite: updatedIsFavorite }
        );

        session.is_favorite = updatedIsFavorite;
        return session;
    },

    /**
     * Update the chat session summary and last summary timestamp
     */
    async updateSummary(id: string, summary: string): Promise<void> {
        await this.update(
            { id },
            {
                summary: summary,
                last_summary_at: new Date()
            }
        );
    },

    /**
     * Update the last intent of the chat session
     */
    async updateLastIntent(id: string, intent: string): Promise<void> {
        await this.update(
            { id },
            {
                last_intent: intent
            }
        );
    }
});