import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { Message, MessageType } from '../entities/message.entity';
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

interface TraditionalPaginatedMessagesResponse {
    data: {
        items: Message[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
    status: number;
}

export class MessagesService {
    private readonly messageRepository: Repository<Message>;

    constructor() {
        this.messageRepository = AppDataSource.getRepository(Message);
    }

    /**
     * Get recent messages for a chat session
     * @param sessionId - The session ID
     * @param limit - Number of messages to retrieve (default: 5)
     * @returns Promise<Message[]> - Array of recent messages
     */
    async getRecentMessages(sessionId: string, limit = 5): Promise<Message[]> {
        try {
            const messages = await this.messageRepository.find({
                where: { chat_session_id: sessionId },
                order: { created_at: 'DESC' },
                take: limit
            });

            return messages;
        } catch (error) {
            logger.error(`Error getting recent messages for session ${sessionId}:`, error);
            return [];
        }
    }

    /**
     * Get messages with cursor-based pagination (reverse chronological order)
     * @param sessionId - The session ID
     * @param cursor - Timestamp cursor for pagination (optional)
     * @param limit - Number of messages to retrieve (default: 20, max: 50)
     * @returns Promise<CursorPaginatedMessagesResponse> - Cursor-paginated message results
     */
    async getMessages(sessionId: string, cursor?: string, limit = 20): Promise<CursorPaginatedMessagesResponse> {
        try {
            // Ensure limit is within bounds
            limit = Math.min(Math.max(limit, 1), 50);
            
            const query = this.messageRepository.createQueryBuilder('message')
                .where('message.chat_session_id = :sessionId', { sessionId })
                .orderBy('message.created_at', 'DESC');

            // Add cursor condition if provided
            if (cursor) {
                const cursorDate = new Date(cursor);
                if (isNaN(cursorDate.getTime())) {
                    throw new Error('Invalid cursor format');
                }
                query.andWhere('message.created_at < :cursor', { cursor: cursorDate });
            }

            // Get limit + 1 to check if there are more messages
            const messages = await query.limit(limit + 1).getMany();
            
            // Check if there are more messages
            const hasMore = messages.length > limit;
            if (hasMore) {
                messages.pop(); // Remove the extra message
            }

            // Get next cursor from the last message
            const nextCursor = messages.length > 0 
                ? messages[messages.length - 1].created_at.toISOString()
                : null;

            // Get total count for UI display (optional)
            const total = await this.messageRepository.count({
                where: { chat_session_id: sessionId }
            });

            return {
                data: {
                    items: messages,
                    total,
                    hasMore,
                    nextCursor
                },
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
     * @param sessionId - The session ID
     * @param userMessage - User's message
     * @param aiResponse - AI's response
     * @param type - Message type (default: MESSAGE)
     */
    async saveMessage(sessionId: string, userMessage: string, aiResponse: string, type: MessageType = MessageType.MESSAGE): Promise<void> {
        try {
            const message = this.messageRepository.create({
                chat_session_id: sessionId,
                user_message: userMessage,
                ai_response: aiResponse,
                type: type
            });
            await this.messageRepository.save(message);

            logger.debug(`Saved ${type} message for session ${sessionId}`);
        } catch (error) {
            logger.error(`Error saving message for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Get total number of messages for a session (for summarization logic)
     * @param sessionId - The session ID
     * @returns Promise<number> - Total message count
     */
    async getTotalMessageCount(sessionId: string): Promise<number> {
        try {
            const count = await this.messageRepository.count({
                where: { chat_session_id: sessionId }
            });
            return count;
        } catch (error) {
            logger.error(`Error getting total message count for session ${sessionId}:`, error);
            return 0;
        }
    }
}