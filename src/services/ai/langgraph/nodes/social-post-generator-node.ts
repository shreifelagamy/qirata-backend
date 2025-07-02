import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AIStreamCallback } from '../../../../types/ai.types';
import { generateSocialPost } from '../../agents/social-post-generator.agent';
import { BaseNode, ChatState } from './base-node';

class WebSocketStreamCallback extends BaseCallbackHandler {
    name = 'websocket_stream_callback';

    constructor(
        private sessionId: string,
        private streamCallback: AIStreamCallback
    ) {
        super();
    }

    async handleLLMStart(): Promise<void> {
        this.streamCallback({
            event: 'start',
            sessionId: this.sessionId
        });
    }

    async handleLLMNewToken(token: string): Promise<void> {
        this.streamCallback({
            event: 'token',
            token,
            sessionId: this.sessionId
        });
    }

    async handleLLMEnd(): Promise<void> {
        this.streamCallback({
            event: 'end',
            sessionId: this.sessionId
        });
    }

    async handleLLMError(error: Error): Promise<void> {
        this.streamCallback({
            event: 'error',
            error: error.message,
            sessionId: this.sessionId
        });
    }
}

export class SocialPostGeneratorNode extends BaseNode {
    constructor() {
        super('SocialPostGenerator');
    }


    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Generating social post', state.sessionId);

            if (!state.models?.socialPostGenerator) {
                throw new Error('Social post generator model not available in state');
            }

            if (!state.platformDetection?.platform) {
                throw new Error('Platform not detected for social post generation');
            }

            const platform = state.platformDetection.platform;

            // Get conversation history from previous messages
            const conversationHistory = state.previousMessages || [];

            // Prepare streaming callbacks if available
            const streamingCallbacks = state.callback ? [
                new WebSocketStreamCallback(state.sessionId, state.callback)
            ] : [];

            // Build user preferences context

            const response = await generateSocialPost({
                model: state.models.socialPostGenerator,
                userMessage: state.userMessage,
                conversationHistory,
                postContent: state.postContent,
                conversationSummary: state.conversationSummary,
                platform,
                streamingCallbacks
            });

            const tokenCount = this.estimateTokenCount(state.userMessage + response);

            return {
                aiResponse: response,
                responseType: 'social_post',
                socialPlatform: platform,
                isSocialPost: true,
                tokenCount
            };
        } catch (error) {
            this.logError('Social post generation error', error, state.sessionId);
            return this.handleError('Social post generation', error);
        }
    }
}