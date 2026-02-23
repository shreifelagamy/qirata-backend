import { AuthenticatedSocket } from '../../../types/socket.types';
import { logger } from '../../../utils/logger';
import { ChatSessionService, MessagesService, PostsService, SettingsService, SocialPostsService } from '../../domain';
import { chatGraph } from './chat.graph';
import { ChatGraphConfigurable } from './configurable';
import { PostProcessorManager } from './post-processors';
import { ChatGraphUpdateType } from './state';

/**
 * Service to orchestrate the Chat StateGraph execution.
 * Handles memory loading, graph invocation, and delegates post-processing to specialized handlers.
 */
export class ChatGraphService {
    // Instantiate services
    private messagesService = new MessagesService();
    private postsService = new PostsService();
    private chatSessionService = new ChatSessionService();
    private postProcessorManager = new PostProcessorManager();
    private settingsService = new SettingsService();
    private socialPostsService = new SocialPostsService();

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

        // 1. Prepare the langgraph state
        const initialState = await this.prepareState(sessionId, userId, message);

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
            logger.info(`✅ [ChatGraph] Finished. Intent: ${result.intentResult?.intent}`);

            const processedResult = await this.postProcessorManager.process({
                result,
                sessionId,
                userId,
                postId: initialState.post!.id,
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
                result.intentResult?.intent || 'unknown'
            );

        } catch (error) {
            logger.error('❌ [ChatGraph] Execution failed:', error);

            emit('chat:stream:error', {
                sessionId,
                error: 'An error occurred while processing your request.'
            });
        }
    }

    private async prepareState(sessionId: string, userId: string, message: string): Promise<ChatGraphUpdateType> {
        // 1. Load necessary data for the state in parallel
        const [socialPosts, chatSession, lastMessages, socialMediaContentPreferences] = await Promise.all([
            this.socialPostsService.findByChatSession(sessionId, userId),
            this.chatSessionService.getById(sessionId, userId),
            this.messagesService.getRecentMessages(sessionId, userId, 5),
            this.settingsService.getSocialMediaContentPreferences(userId)
        ]);

        const post = await this.postsService.getPostWithExpanded(chatSession!.post_id!, userId)

        // 2. Prepare the initial state
        return {
            message,
            sessionId,
            userId,
            socialMediaContentPreferences,

            // Map memory fields
            lastMessages: lastMessages.reverse().map(m => ({
                user_message: m.user_message,
                ai_response: m.ai_response
            })),
            lastIntent: chatSession!.last_intent ?? undefined,

            // post data
            post: {
                id: post!.id,
                title: post!.title || '',
                summary: post!.expanded!.summary || '',
                content: post!.expanded!.content || ''
            },

            // social posts history for context
            socialPostsHistory: socialPosts.map(sp => ({
                id: sp.id,
                platform: sp.platform as 'twitter' | 'linkedin',
                content: sp.content,
                codeExamples: sp.code_examples?.map(ce => ({
                    language: ce.language,
                    code: ce.code,
                    description: ce.description ?? null
                })) || [],
            })),

            // Default empty values for outputs
            response: undefined,
            suggestedOptions: undefined
        };

    }
}
