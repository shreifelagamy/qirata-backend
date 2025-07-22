import { generateSocialPost, StructuredSocialPostOutput } from '../../agents/social-post-generator.agent';
import { BaseNode, ChatState } from './base-node';

export class SocialPostGeneratorNode extends BaseNode {
    constructor() {
        super('SocialPostGenerator');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo(`Generating social post ${state.sessionId}`);

            if (!state.platformDetection?.platform) {
                throw new Error('Platform not detected for social post generation');
            }

            const platform = state.platformDetection.platform;

            // Get conversation history from previous messages
            const conversationHistory = state.previousMessages || [];

            if (state.callback) {
                state.callback({
                    event: 'social:start',
                    sessionId: state.sessionId,
                    message: `Starting social post generation for platform: ${platform}`
                });
            }

            const stream = await generateSocialPost({
                userMessage: state.userMessage,
                conversationHistory,
                postContent: state.postContent,
                conversationSummary: state.conversationSummary,
                platform,
                socialMediaContentPreferences: state.socialMediaContentPreferences,
                socialPosts: state.socialPosts
            });

            let finalResult: StructuredSocialPostOutput | undefined = undefined;

            for await (const chunk of stream) {
                if (state.callback) {
                    state.callback({
                        event: 'social:content',
                        data: chunk,
                        sessionId: state.sessionId
                    });
                }

                finalResult = chunk;
            }

            if (state.callback) {
                state.callback({
                    event: 'social:complete',
                    data: finalResult,
                    sessionId: state.sessionId
                });
            }

            const tokenCount = this.estimateTokenCount(state.userMessage + finalResult?.postContent);

            return {
                aiResponse: JSON.stringify(finalResult), // JSON stringified structured response
                responseType: 'social',
                socialPlatform: platform,
                isSocialPost: true,
                structuredSocialPost: finalResult,
                tokenCount
            };
        } catch (error) {
            this.logError('Social post generation error', error, state.sessionId);
            return this.handleError('Social post generation', error);
        }
    }
}