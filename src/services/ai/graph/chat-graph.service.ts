import { AuthenticatedSocket } from '../../../types/socket.types';
import { ChatSessionService } from '../../chat-session.service';
import { MessagesService } from '../../messages.service';
import { PostsService } from '../../posts.service';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import { chatGraph } from './chat.graph';
import { ChatGraphConfigurable } from './configurable';
import { PostProcessorManager } from './post-processors';
import { logger } from '../../../utils/logger';

/**
 * Service to orchestrate the Chat StateGraph execution.
 * Handles memory loading, graph invocation, and delegates post-processing to specialized handlers.
 */
export class ChatGraphService {
    // Instantiate services
    private socketMemoryService = new SocketMemoryService();
    private messagesService = new MessagesService();
    private postsService = new PostsService();
    private chatSessionService = new ChatSessionService();
    private postProcessorManager = new PostProcessorManager();

    /**
     * Main entry point to run the chat graph
     */
    async run(params: {
        message: string;
        socket: AuthenticatedSocket;
        sessionId: string;
        userId: string;
        emit: (event: string, data: any) => void;
    }): Promise<void> {
        const { message, socket, sessionId, userId, emit } = params;

        console.log(`🚀 [ChatGraph] Starting workflow for session ${sessionId}`);

        // 1. load the data from the DB
        const chatSession = await this.chatSessionService.getById(sessionId, userId);
        const post = await this.postsService.getPostWithExpanded(chatSession!.post_id!, userId)
        const lastMessages = await this.messagesService.getRecentMessages(sessionId, userId, 5);

        // 2. Prepare the initial state
        // Map the existing memory structure to our new Zod-based state
        const initialState = {
            message,
            sessionId,
            userId,

            // Map memory fields
            lastMessages: lastMessages.reverse().map(m => ({
                user_message: m.user_message,
                ai_response: m.ai_response
            })),
            lastIntent: chatSession!.last_intent ?? undefined,

            // post data
            post: {
                title: post!.title || '',
                summary: post!.expanded!.summary || '',
                content: post!.expanded!.content || ''
            },

            // Default empty values for outputs
            response: undefined,
            suggestedOptions: undefined
        };

        // 3. Prepare configuration (services)
        const config: { configurable: ChatGraphConfigurable } = {
            configurable: {
                thread_id: sessionId,
                session_id: sessionId,
                emit
            }
        };

        try {
            // Emit start event
            emit('chat:stream:start', {
                sessionId,
                intentType: 'Processing your request...'
            });

            // 4. Invoke the Graph
            const result = await chatGraph.invoke(initialState, config);

            // 5. Process Result using Post-Processor Manager
            logger.info(`✅ [ChatGraph] Finished. Intent: ${result.intentResult?.type}`);

            const processedResult = await this.postProcessorManager.process({
                result,
                sessionId,
                userId,
                postId: post?.id,
                message,
                emit
            });

            // 6. Emit completion event
            emit('chat:stream:end', {
                sessionId,
                message: 'Process completed',
                response: processedResult.response,
                suggestedOptions: processedResult.suggestedOptions,
                isSocialPost: processedResult.isSocialPost,
                socialPostId: processedResult.socialPostId,
                structuredPost: processedResult.structuredPost || null
            });

            // 7. Save message and update session intent
            await this.messagesService.saveMessage(
                sessionId,
                userId,
                message,
                processedResult.response,
                processedResult.socialPostId
            );
            await this.chatSessionService.updateLastIntent(
                sessionId,
                result.intentResult?.type || 'unknown'
            );

        } catch (error) {
            logger.error('❌ [ChatGraph] Execution failed:', error);

            emit('chat:stream:error', {
                sessionId,
                error: 'An error occurred while processing your request.'
            });
        }
    }
}
