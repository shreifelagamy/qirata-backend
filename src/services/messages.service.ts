import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { Message, MessageType } from '../entities/message.entity';
import { logger } from '../utils/logger';

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
     * Get messages with pagination
     * @param sessionId - The session ID
     * @param page - Page number (default: 1)
     * @param pageSize - Number of messages per page (default: 20)
     * @returns Promise<object> - Paginated message results
     */
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