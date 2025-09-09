import { langGraphChatService } from '../../services/ai/langgraph-chat.service';
import { QirataChatWorkflow } from '../../services/ai/workflows/qirata-chat.workflow';
import { ChatSessionService } from '../../services/chat-session.service';
import { MessagesService } from '../../services/messages.service';
import { PostsService } from '../../services/posts.service';
import { SettingsService } from '../../services/settings.service';
import { SocialPostsService } from '../../services/social-posts.service';
import { AICallbackData } from '../../types/ai.types';
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
    private qirataChatWorkflow = new QirataChatWorkflow();
    private activeStreams = new Map<string, boolean>();

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
            // Delegate to the workflow class - much cleaner!
            await this.qirataChatWorkflow.start({
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
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        const { reason } = data;
        const sessionId = socket.data.sessionId!;

        try {
            // Cancel the AI workflow first and get feedback
            const wasCancelled = langGraphChatService.cancelExistingRequest(sessionId);

            // Clean up local stream state
            this.cleanupStream(sessionId, socket);

            // Notify client with detailed feedback
            if (wasCancelled) {
                emit('chat:stream:interrupted', {
                    sessionId,
                    message: 'Stream interrupted successfully',
                    reason: reason || 'user request'
                });
                logger.info(`Stream successfully interrupted for session ${sessionId}, reason: ${reason || 'user request'}`);
            } else {
                emit('chat:stream:interrupted', {
                    sessionId,
                    message: 'No active stream to interrupt',
                    reason: reason || 'user request'
                });
                logger.warn(`No active stream to interrupt for session ${sessionId}`);
            }
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
     * Join chat session
     */
    async joinSession(
        sessionId: string,
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            await socket.join(sessionId);
            logger.debug(`Socket ${socket.id} joined chat session ${sessionId}`);
        } catch (error) {
            logger.error(`Error joining session ${sessionId}:`, error);
            emit('error', {
                message: 'Failed to join chat session',
                code: 'JOIN_SESSION_ERROR'
            });
        }
    }

    /**
     * Leave chat session
     */
    async leaveSession(
        sessionId: string,
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            await socket.leave(sessionId);
            socket.data.activeStreams?.delete(sessionId);
            this.activeStreams.delete(sessionId);
            logger.debug(`Socket ${socket.id} left chat session ${sessionId}`);
        } catch (error) {
            logger.error(`Error leaving session ${sessionId}:`, error);
        }
    }

    /**
     * Update user preferences that affect AI responses
     */
    async updatePreferences(
        data: { preferences: any },
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            // TODO: Implement user preferences storage
            // For now, just acknowledge the update
            emit('chat:preferences:updated', {
                success: true,
                preferences: data.preferences
            });

            logger.info(`Updated preferences for user ${userId}`);
        } catch (error) {
            logger.error(`Error updating preferences for user ${userId}:`, error);
            emit('error', {
                message: 'Failed to update preferences',
                code: 'PREFERENCES_UPDATE_ERROR'
            });
        }
    }

    /**
     * Handle streaming callback from AI service
     */
    private handleStreamCallback(
        sessionId: string,
        data: AICallbackData,
        emit: (event: string, data: any) => void
    ): void {
        try {

            // Check if stream is still active - if not, ignore all callbacks
            if (!this.activeStreams.get(sessionId)) {
                logger.debug(`Ignoring callback for interrupted stream ${sessionId}: ${data.event}`);
                return; // Stream was interrupted
            }

            switch (data.event) {
                case 'start':
                    emit('chat:stream:start', {
                        sessionId,
                        intentType: 'Processing...'
                    });
                    break;

                case 'token':
                    if (data.token) {
                        emit('chat:stream:token', {
                            sessionId,
                            token: data.token
                        });
                    }
                    break;

                case 'end':
                    // End event is handled in main handleMessage method
                    // This callback 'end' event just marks that streaming tokens have finished
                    break;

                case 'error':
                    // Only emit error if stream is still active (not manually interrupted)
                    if (this.activeStreams.get(sessionId)) {
                        emit('chat:stream:error', {
                            sessionId,
                            error: data.error || 'Unknown streaming error'
                        });
                    }
                    break;

                default:
                    emit(`chat:stream:${data.event}`, {
                        ...data,
                        sessionId
                    });
            }
        } catch (error) {
            logger.error(`Error in handleStreamCallback for session ${sessionId}:`, error);
        }
    }

    /**
     * Clean up stream state
     */
    private cleanupStream(sessionId: string, socket: AuthenticatedSocket): void {
        this.activeStreams.delete(sessionId);
        socket.data.activeStreams?.delete(sessionId);
    }

    /**
     * Handle socket disconnect - cleanup all streams for this socket
     */
    async handleDisconnect(
        data: any,
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            if (socket.data.activeStreams) {
                for (const sessionId of socket.data.activeStreams) {
                    // Cancel ongoing AI processes for this session
                    langGraphChatService.cancelExistingRequest(sessionId);
                    this.activeStreams.delete(sessionId);
                }
                socket.data.activeStreams.clear();
            }

            logger.debug(`Cleaned up streams for disconnected socket ${socket.id}`);
        } catch (error) {
            logger.error(`Error cleaning up streams for socket ${socket.id}:`, error);
        }
    }

    // Legacy methods for backward compatibility

    /**
     * Handle legacy message received event
     */
    async handleLegacyMessage(
        message: { roomId: string; content: string; userId: string },
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            emit('onMessageReceived', message);
            logger.info(`Legacy message received in room ${message.roomId} from user ${message.userId}`);
        } catch (error) {
            logger.error(`Error in handleLegacyMessage: ${error}`);
            emit('error', {
                message: 'Failed to handle message',
                code: 'MESSAGE_RECEIVED_ERROR'
            });
        }
    }

    /**
     * Handle typing status event
     */
    async handleTypingStatus(
        data: { roomId: string; userId: string; isTyping: boolean },
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            emit('onTypingStatus', data);
            logger.debug(`Typing status updated in room ${data.roomId} for user ${data.userId}: ${data.isTyping}`);
        } catch (error) {
            logger.error(`Error in handleTypingStatus: ${error}`);
            emit('error', {
                message: 'Failed to handle typing status',
                code: 'TYPING_STATUS_ERROR'
            });
        }
    }

    /**
     * Handle stream response event
     */
    async handleStreamResponse(
        data: { roomId: string; chunk: string },
        userId: string,
        socket: AuthenticatedSocket,
        emit: (event: string, data: any) => void
    ): Promise<void> {
        try {
            emit('onStreamResponse', data);
            logger.debug(`Stream chunk sent to room ${data.roomId}`);
        } catch (error) {
            logger.error(`Error in handleStreamResponse: ${error}`);
            emit('error', {
                message: 'Failed to handle stream response',
                code: 'STREAM_RESPONSE_ERROR'
            });
        }
    }


    private handleActiveStream(sessionId: string, socket: AuthenticatedSocket): void {
        // Prepare the context and save it in the memory
        if (socket.data.activeStreams?.has(sessionId)) {
            socket.data.activeStreams.delete(sessionId);
        }
        socket.data.activeStreams?.add(sessionId);
    }
}