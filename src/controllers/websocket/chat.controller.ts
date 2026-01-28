import { ChatGraphService } from '../../services/ai/graph/chat-graph.service';
import { ChatSessionService } from '../../services/chat-session.service';
import { MessagesService } from '../../services/messages.service';
import { PostsService } from '../../services/posts.service';
import { SettingsService } from '../../services/settings.service';
import { SocialPostsService } from '../../services/social-posts.service';
import { AuthenticatedSocket, ChatMessageData, StreamInterruptData } from '../../types/socket.types';
import { logger } from '../../utils/logger';


/**
 * Unified Chat Controller - Handles both Q&A and Social Post Generation
 * Based on AI intent detection, responds with either answers or social posts
 */
export class ChatController {
    private chatSessionService = new ChatSessionService();
    private messagesService = new MessagesService();
    private postService = new PostsService();
    private socialPostsService = new SocialPostsService();
    private settingsService = new SettingsService();
    private chatGraphService = new ChatGraphService();

    /**
     * Main method - handles both Q&A and social generation
     * The AI service (LangChain) determines intent and responds accordingly
     */
    async handleMessage(
        data: ChatMessageData,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        const sessionId = socket.data.sessionId!
        const { userId } = socket.data

        this.handleActiveStream(sessionId, socket)

        try {
            // Delegate to the new ChatGraphService (StateGraph implementation)
            await this.chatGraphService.run({
                message: data.content,
                socket,
                sessionId,
                userId,
                emit
            });
        } catch (error) {
            logger.error(`Error in chat workflow for session ${sessionId}:`, error);
            emit('chat:stream:error', {
                sessionId,
                error: 'Failed to process message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Handle stream interruption
     */
    async handleInterrupt(
        data: StreamInterruptData,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        const { reason } = data;
        const sessionId = socket.data.sessionId!;

        try {
            // Cancel the AI workflow first and get feedback
            const abortController = socket.data.activeStreams?.get(sessionId);
            abortController?.abort(reason)
            const wasCancelled = abortController?.signal.aborted;

            // Notify client with detailed feedback
            const message = wasCancelled ? 'Stream interrupted successfully' : 'No active stream to interrupt';
            logger.warn(`${message} ${sessionId}`);

            emit('chat:stream:interrupted', {
                sessionId,
                message,
                reason: reason || 'user request'
            });
        } catch (error) {
            logger.error(`Error in handleInterrupt for session ${sessionId}:`, error);
            emit('chat:stream:error', {
                sessionId,
                error: 'Failed to interrupt stream',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Handle socket disconnect - cleanup all streams for this socket
     */
    async handleDisconnect(
        data: any,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            if (socket.data.activeStreams) {
                socket.data.activeStreams.clear();
            }

            logger.debug(`Cleaned up streams for disconnected socket ${socket.id}`);
        } catch (error) {
            logger.error(`Error cleaning up streams for socket ${socket.id}:`, error);
        }
    }

    private handleActiveStream(sessionId: string, socket: AuthenticatedSocket): void {
        // Prepare the context and save it in the memory
        if (socket.data.activeStreams?.has(sessionId)) {
            const activeStreams = socket.data.activeStreams.get(sessionId);
            activeStreams?.abort();
            socket.data.activeStreams.delete(sessionId);
        }

        const abortController = new AbortController();
        socket.data.activeStreams?.set(sessionId, abortController);
    }
}