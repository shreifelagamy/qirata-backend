import { BaseNode, ChatState } from './base-node';
import { IntentDetectionResult } from '../../../../types/ai.types';
import { IntentDetectionService } from '../../intent-detection.service';

export class IntentDetectionNode extends BaseNode {
    private intentService: IntentDetectionService;

    constructor(intentService: IntentDetectionService) {
        super('IntentDetection');
        this.intentService = intentService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Detecting intent', state.sessionId);

            const intentResult: IntentDetectionResult = await this.intentService.detectIntent(
                state.userMessage,
                state.context?.previousMessages
            );

            return {
                intent: intentResult.intent,
                confidence: intentResult.intent.confidence
            };
        } catch (error) {
            this.logError('Intent detection error', error, state.sessionId);
            return this.handleError('Intent detection', error);
        }
    }
}