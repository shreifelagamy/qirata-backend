import { BaseNode, ChatState } from './base-node';
import { PlatformDetectionService } from '../../platform-detection.service';

export class PlatformClarificationNode extends BaseNode {
    constructor() {
        super('PlatformClarification');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Generating platform clarification', state.sessionId);

            // Create a temporary service just to get the clarification message
            // This doesn't require a model since it's just a static message
            const platformDetectionService = new PlatformDetectionService(state.models?.platformDetection!);
            const clarificationMessage = platformDetectionService.generatePlatformClarificationMessage();
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