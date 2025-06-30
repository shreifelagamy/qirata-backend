import { BaseNode, ChatState } from './base-node';
import { PlatformDetectionService, PlatformDetectionContext } from '../../platform-detection.service';

export class PlatformDetectionNode extends BaseNode {
    constructor() {
        super('PlatformDetection');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Detecting platform using AI', state.sessionId);

            if (!state.models?.platformDetection) {
                throw new Error('Platform detection model not available in state');
            }

            const platformDetectionService = new PlatformDetectionService(state.models.platformDetection);
            const context: PlatformDetectionContext = {
                userMessage: state.userMessage,
                conversationHistory: state.context?.previousMessages,
                previousMessages: state.context?.previousMessages
            };

            const platformDetection = await platformDetectionService.detectPlatform(context);

            return {
                platformDetection,
                needsPlatformClarification: platformDetection.needsClarification,
                socialPlatform: platformDetection.platform
            };
        } catch (error) {
            this.logError('AI platform detection error', error, state.sessionId);
            return this.handleError('AI platform detection', error);
        }
    }
}