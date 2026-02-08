import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Message } from '../entities/message.entity';

export interface MessagesRepository extends Repository<Message> {
    findRecent(sessionId: string, userId: string, limit?: number): Promise<Message[]>;
    findWithCursor(sessionId: string, userId: string, cursor?: string, limit?: number): Promise<{ items: Message[]; hasMore: boolean; nextCursor: string | null }>;
    countBySession(sessionId: string, userId: string): Promise<number>;
}

export const MessagesRepository = AppDataSource.getRepository(Message).extend({
    /**
     * Find recent messages for a chat session (newest first)
     */
    async findRecent(sessionId: string, userId: string, limit = 5): Promise<Message[]> {
        return this.find({
            where: { chat_session_id: sessionId, user_id: userId },
            order: { created_at: 'DESC' },
            take: limit
        });
    },

    /**
     * Find messages with cursor-based pagination, eager-loading social posts
     */
    async findWithCursor(
        sessionId: string,
        userId: string,
        cursor?: string,
        limit = 20
    ): Promise<{ items: Message[]; hasMore: boolean; nextCursor: string | null }> {
        limit = Math.min(Math.max(limit, 1), 50);

        const query = this.createQueryBuilder('message')
            .leftJoinAndSelect('message.social_post', 'social_post')
            .where('message.chat_session_id = :sessionId AND message.user_id = :userId', { sessionId, userId })
            .orderBy('message.created_at', 'DESC');

        if (cursor) {
            const cursorDate = new Date(cursor);
            if (isNaN(cursorDate.getTime())) {
                throw new Error('Invalid cursor format');
            }
            query.andWhere('message.created_at < :cursor', { cursor: cursorDate });
        }

        const messages = await query.limit(limit + 1).getMany();

        const hasMore = messages.length > limit;
        if (hasMore) {
            messages.pop();
        }

        const nextCursor = messages.length > 0
            ? messages[messages.length - 1].created_at.toISOString()
            : null;

        return { items: messages, hasMore, nextCursor };
    },

    /**
     * Count total messages in a session for a user
     */
    async countBySession(sessionId: string, userId: string): Promise<number> {
        return this.count({
            where: { chat_session_id: sessionId, user_id: userId }
        });
    }
});
