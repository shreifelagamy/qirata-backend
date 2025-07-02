import { detectPlatform } from '../../agents/platform-detection.agent';
import { BaseNode, ChatState } from './base-node';

export class PlatformDetectionNode extends BaseNode {
    constructor() {
        super('PlatformDetection');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Detecting platform using AI', state.sessionId);

            const platformDetection = await detectPlatform({
                userMessage: state.userMessage,
                conversationHistory: state.previousMessages
            });

            // log platform detection result as string
            this.logInfo('[PlatformDetection] Result:', JSON.stringify(platformDetection, null, 2));

            return {
                platformDetection,
            };
        } catch (error) {
            this.logError('AI platform detection error', error, state.sessionId);
            return this.handleError('AI platform detection', error);
        }
    }
}