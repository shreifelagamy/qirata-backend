import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatOllama } from '@langchain/ollama';
import { BaseNode, ChatState } from './base-node';
import { AIStreamCallback } from '../../../../types/ai.types';
import { SocialPostGeneratorService } from '../../social-post-generator.service';

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
    private chatModel: ChatOllama;
    private socialPostGeneratorService: SocialPostGeneratorService;

    constructor(chatModel: ChatOllama, socialPostGeneratorService: SocialPostGeneratorService) {
        super('SocialPostGenerator');
        this.chatModel = chatModel;
        this.socialPostGeneratorService = socialPostGeneratorService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Generating social post', state.sessionId);

            const platform = state.platformDetection?.platform || state.socialPlatform!;
            const prompt = this.socialPostGeneratorService.buildSocialPostPromptTemplate(platform);

            const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

            const callbacks = state.callback ? [
                new WebSocketStreamCallback(state.sessionId, state.callback)
            ] : [];

            const response = await chain.invoke({
                userMessage: state.userMessage,
                postContent: state.context?.postContent || 'No post content provided',
                conversationSummary: state.context?.conversationSummary || '',
                userPreferences: this.socialPostGeneratorService.buildUserPreferencesContext(state.context)
            }, { callbacks });

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