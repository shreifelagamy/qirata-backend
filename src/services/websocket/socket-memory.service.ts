import { ChatSessionService } from '../chat-session.service';
import { MessagesService } from '../messages.service';
import { MemoryStateType, SimplifiedMessage } from '../ai/tasks/types';
import { AuthenticatedSocket } from '../../types/socket.types';

// Method parameter interfaces
interface EnsureMemoryParams {
    socket: AuthenticatedSocket;
    sessionId: string;
    userId: string;
}

interface AddMessageParams {
    socket: AuthenticatedSocket;
    sessionId: string;
    userMessage: string;
    aiResponse: string;
}

interface UpdateContextParams {
    socket: AuthenticatedSocket;
    sessionId: string;
    updates: Partial<MemoryStateType>;
}

interface SetDetectedPlatformParams {
    socket: AuthenticatedSocket;
    sessionId: string;
    platform: 'twitter' | 'linkedin';
}

interface SetSocialPostContentParams {
    socket: AuthenticatedSocket;
    sessionId: string;
    content: string;
    platform: 'twitter' | 'linkedin';
}

interface GetMemoryParams {
    socket: AuthenticatedSocket;
    sessionId: string;
}

interface ClearMemoryParams {
    socket: AuthenticatedSocket;
    sessionId: string;
}

interface ClearAllMemoryParams {
    socket: AuthenticatedSocket;
}

/**
 * Service for managing WebSocket session memory cache
 * Handles all memory operations for chat sessions stored in socket data
 */
export class SocketMemoryService {
    private chatSessionService = new ChatSessionService();
    private messagesService = new MessagesService();

    /**
     * Get or build memory for a session, automatically caching in socket
     */
    async ensureMemory({ socket, sessionId, userId }: EnsureMemoryParams): Promise<MemoryStateType> {
        // Initialize memory cache if not exists
        if (!socket.data.memoryCache) {
            socket.data.memoryCache = new Map<string, any>();
        }

        // Get memory from socket cache
        let memory = socket.data.memoryCache.get(sessionId) as MemoryStateType;

        // Build memory if it doesn't exist or is incomplete
        if (!memory || !memory.currentPostId) {
            memory = await this.buildMemoryFromDatabase(sessionId, userId);
            socket.data.memoryCache.set(sessionId, memory);
        }

        return memory;
    }

    /**
     * Add a conversation message to memory and update cache
     */
    addMessage({ socket, sessionId, userMessage, aiResponse }: AddMessageParams): void {
        const memory = this.getMemoryFromCache({ socket, sessionId });
        if (!memory) return;

        // Add new message
        memory.lastMessages.push({
            user_message: userMessage,
            ai_response: aiResponse
        });
        
        // Update message count
        memory.messagesCount = memory.lastMessages.length;
        
        // Keep only last 10 messages to prevent memory bloat
        if (memory.lastMessages.length > 10) {
            memory.lastMessages = memory.lastMessages.slice(-10);
        }

        // Update cache
        socket.data.memoryCache?.set(sessionId, memory);
    }

    /**
     * Update memory context and merge with existing data
     */
    updateContext({ socket, sessionId, updates }: UpdateContextParams): MemoryStateType {
        const memory = this.getMemoryFromCache({ socket, sessionId });
        if (!memory) throw new Error(`Memory not found for session ${sessionId}`);

        // Merge context updates with existing memory
        const updatedMemory = { ...memory, ...updates };
        
        // Update cache
        socket.data.memoryCache?.set(sessionId, updatedMemory);
        
        return updatedMemory;
    }

    /**
     * Set detected platform in memory
     */
    setDetectedPlatform({ socket, sessionId, platform }: SetDetectedPlatformParams): void {
        this.updateContext({ socket, sessionId, updates: { detectedPlatform: platform } });
    }

    /**
     * Store generated social post content in memory
     */
    setSocialPostContent({ socket, sessionId, content, platform }: SetSocialPostContentParams): void {
        this.updateContext({ socket, sessionId, updates: {
            lastGeneratedSocialPost: content,
            lastGeneratedPlatform: platform
        }});
    }

    /**
     * Get current memory from socket cache
     */
    getMemoryFromCache({ socket, sessionId }: GetMemoryParams): MemoryStateType | undefined {
        return socket.data.memoryCache?.get(sessionId) as MemoryStateType;
    }

    /**
     * Clear memory for a session
     */
    clearMemory({ socket, sessionId }: ClearMemoryParams): void {
        socket.data.memoryCache?.delete(sessionId);
    }

    /**
     * Clear all memory for a socket (useful on disconnect)
     */
    clearAllMemory({ socket }: ClearAllMemoryParams): void {
        socket.data.memoryCache?.clear();
    }

    /**
     * Build memory from database data
     */
    private async buildMemoryFromDatabase(
        sessionId: string,
        userId: string
    ): Promise<MemoryStateType> {
        // Get session and message data
        const session = await this.chatSessionService.findOne(sessionId, userId);
        const rawMessages = await this.messagesService.getRecentMessages(sessionId, userId, 10);
        const totalMessageCount = await this.messagesService.getTotalMessageCount(sessionId, userId);

        // Transform messages to simplified format
        const messages: SimplifiedMessage[] = rawMessages.map(msg => ({
            user_message: msg.user_message,
            ai_response: msg.ai_response
        }));

        // Build memory object
        return {
            sessionId: sessionId,
            userId: userId,
            // post related
            currentPostId: session?.post_id,
            postSummary: session?.post?.expanded?.summary,
            // conversation related
            lastMessages: messages.reverse(), // Most recent first
            messagesCount: totalMessageCount,
            conversationSummary: session?.summary,
        };
    }
}