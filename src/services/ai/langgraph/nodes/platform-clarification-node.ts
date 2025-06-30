import { BaseNode, ChatState } from './base-node';
import { PlatformDetectionService } from '../../platform-detection.service';

export class PlatformClarificationNode extends BaseNode {
    private platformDetectionService: PlatformDetectionService;

    constructor(platformDetectionService: PlatformDetectionService) {
        super('PlatformClarification');
        this.platformDetectionService = platformDetectionService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Generating platform clarification', state.sessionId);

            const clarificationMessage = this.platformDetectionService.generatePlatformClarificationMessage();
            const tokenCount = this.estimateTokenCount(state.userMessage + clarificationMessage);

            state.callback?.({
                event: 'token',
                sessionId: state.sessionId,
                token: clarificationMessage,
            });

            return {
                aiResponse: clarificationMessage,
                responseType: 'platform_clarification',
                waitingForPlatformChoice: true,
                tokenCount
            };
        } catch (error) {
            this.logError('Platform clarification error', error, state.sessionId);
            return this.handleError('Platform clarification', error);
        }
    }
}