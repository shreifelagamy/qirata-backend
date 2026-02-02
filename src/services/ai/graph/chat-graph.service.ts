import { MessageType } from '../../../entities/message.entity';
import { AuthenticatedSocket } from '../../../types/socket.types';
import { ChatSessionService } from '../../chat-session.service';
import { MessagesService } from '../../messages.service';
import { PostsService } from '../../posts.service';
import { SocialPostsService } from '../../social-posts.service';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import { chatGraph } from './chat.graph';
import { ChatGraphConfigurable } from './configurable';

/**
 * Service to orchestrate the Chat StateGraph execution.
 * Handles memory loading, graph invocation, and side effects.
 */
export class ChatGraphService {
    // Instantiate services
    private socketMemoryService = new SocketMemoryService();
    private messagesService = new MessagesService();
    private socialPostsService = new SocialPostsService();
    private postsService = new PostsService();
    private chatSessionService = new ChatSessionService();

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
            lastMessages: lastMessages.map(m => ({
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

            // 5. Handle Result
            console.log(`✅ [ChatGraph] Finished. Intent: ${result.intentResult?.type}`);

            // Extract the response from the graph result
            const response = result.response || "I'm not sure how to help with that.";
            const suggestedOptions = result.suggestedOptions || [];
            const messageType = result.messageType || MessageType.MESSAGE;

            emit('chat:stream:end', {
                sessionId,
                message: 'Process completed',
                response,
                suggestedOptions,
                messageType,
                structuredPost: null // TODO: Handle structured posts when we add social post nodes
            });

            // 6. Side Effects: Save message and update session intent
            this.messagesService.saveMessage(sessionId, userId, message, response, messageType);
            this.chatSessionService.updateLastIntent(sessionId, result.intentResult?.type || 'unknown');

        } catch (error) {
            console.error('❌ [ChatGraph] Execution failed:', error);

            emit('chat:stream:error', {
                sessionId,
                error: 'An error occurred while processing your request.'
            });
        }
    }
}
