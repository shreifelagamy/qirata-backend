import { AuthenticatedSocket } from '../../../types/socket.types';
import { MessagesService } from '../../messages.service';
import { SocialPostsService } from '../../social-posts.service';
import { PostsService } from '../../posts.service';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import { chatGraph } from './chat.graph';
import { ChatGraphConfigurable } from './configurable';
import { MessageType } from '../../../entities/message.entity';

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

        // 1. Ensure memory is loaded
        // We use the existing socket memory service to get the context
        const memory = await this.socketMemoryService.ensureMemory({ socket, sessionId, userId });

        // 2. Prepare the initial state
        // Map the existing memory structure to our new Zod-based state
        const initialState = {
            message,
            sessionId,
            userId,
            
            // Map memory fields
            lastMessages: memory.lastMessages.map(m => ({
                user_message: m.user_message,
                ai_response: m.ai_response
            })),
            lastIntent: memory.lastIntent,
            
            // Default empty values for outputs
            response: undefined,
            suggestedOptions: undefined
        };

        // 3. Prepare configuration (services)
        const config: { configurable: ChatGraphConfigurable } = {
            configurable: {
                thread_id: sessionId,
                session_id: sessionId,
                socket,
                emit,
                socketMemoryService: this.socketMemoryService,
                messagesService: this.messagesService,
                socialPostsService: this.socialPostsService,
                postsService: this.postsService
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

            // 5. Handle Result (Temporary for Intent Detection Phase)
            const intentResult = result.intentResult;

            if (intentResult) {
                console.log(`✅ [ChatGraph] Finished. Intent: ${intentResult.type} (${intentResult.confidence})`);
                
                // For now, return a debug response to the user
                const debugResponse = `[DEBUG] Intent Detected: **${intentResult.type}**\nConfidence: ${intentResult.confidence}\nReasoning: ${intentResult.reasoning}`;
                
                emit('chat:stream:end', {
                    sessionId,
                    message: 'Process completed',
                    response: debugResponse,
                    suggestedOptions: [],
                    messageType: MessageType.MESSAGE,
                    structuredPost: null
                });
            } else {
                console.warn('⚠️ [ChatGraph] Finished but no intent result found.');
                emit('chat:stream:end', {
                    sessionId,
                    message: 'Process completed',
                    response: "Error: No intent detected.",
                    suggestedOptions: [],
                    messageType: MessageType.MESSAGE,
                    structuredPost: null
                });
            }

        } catch (error) {
            console.error('❌ [ChatGraph] Execution failed:', error);
            
            emit('chat:stream:error', {
                sessionId,
                error: 'An error occurred while processing your request.'
            });
        }
    }
}
