import { BaseNode, ChatState } from './base-node';
import { PlatformDetectionService, PlatformDetectionContext } from '../../platform-detection.service';

export class PlatformDetectionNode extends BaseNode {
    private platformDetectionService: PlatformDetectionService;

    constructor(platformDetectionService: PlatformDetectionService) {
        super('PlatformDetection');
        this.platformDetectionService = platformDetectionService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Detecting platform using AI', state.sessionId);

            const context: PlatformDetectionContext = {
                userMessage: state.userMessage,
                conversationHistory: state.context?.previousMessages,
                previousMessages: state.context?.previousMessages
            };

            const platformDetection = await this.platformDetectionService.detectPlatform(context);

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