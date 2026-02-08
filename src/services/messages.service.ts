import { Message } from '../entities/message.entity';
import { MessagesRepository } from '../repositories';
import { logger } from '../utils/logger';

interface CursorPaginatedMessagesResponse {
    data: {
        items: Message[];
        total: number;
        hasMore: boolean;
        nextCursor: string | null;
    };
    status: number;
}

export class MessagesService {
    /**
     * Get recent messages for a chat session
     */
    async getRecentMessages(sessionId: string, userId: string, limit = 5): Promise<Message[]> {
        try {
            return await MessagesRepository.findRecent(sessionId, userId, limit);
        } catch (error) {
            logger.error(`Error getting recent messages for session ${sessionId}:`, error);
            return [];
        }
    }

    /**
     * Get messages with cursor-based pagination (reverse chronological order)
     * Messages include their associated social post when available
     */
    async getMessages(sessionId: string, userId: string, cursor?: string, limit = 20): Promise<CursorPaginatedMessagesResponse> {
        try {
            const { items, hasMore, nextCursor } = await MessagesRepository.findWithCursor(sessionId, userId, cursor, limit);
            const total = await MessagesRepository.countBySession(sessionId, userId);

            return {
                data: { items, total, hasMore, nextCursor },
                status: 200
            };
        } catch (error) {
            logger.error(`Error getting messages for session ${sessionId}:`, error);
            if (error instanceof Error && error.message === 'Invalid cursor format') {
                throw error;
            }
            throw new Error('Failed to retrieve messages');
        }
    }

    /**
     * Save a chat message to the database
     */
    async saveMessage(sessionId: string, userId: string, userMessage: string, aiResponse: string, socialPostId?: string): Promise<void> {
        try {
            const message = MessagesRepository.create({
                chat_session_id: sessionId,
                user_id: userId,
                user_message: userMessage,
                ai_response: aiResponse,
                social_post_id: socialPostId
            });
            await MessagesRepository.save(message);

            logger.debug(`Saved message for session ${sessionId}${socialPostId ? ` (social_post: ${socialPostId})` : ''}`);
        } catch (error) {
            logger.error(`Error saving message for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Get total number of messages for a session
     */
    async getTotalMessageCount(sessionId: string, userId: string): Promise<number> {
        try {
            return await MessagesRepository.countBySession(sessionId, userId);
        } catch (error) {
            logger.error(`Error getting total message count for session ${sessionId}:`, error);
            return 0;
        }
    }
}
