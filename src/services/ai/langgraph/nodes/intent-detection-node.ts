import { BaseNode, ChatState } from './base-node';
import { IntentDetectionResult } from '../../../../types/ai.types';
import { IntentDetectionService } from '../../intent-detection.service';

export class IntentDetectionNode extends BaseNode {
    constructor() {
        super('IntentDetection');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Detecting intent', state.sessionId);

            if (!state.models?.intentDetection) {
                throw new Error('Intent detection model not available in state');
            }

            const intentService = new IntentDetectionService(state.models.intentDetection);
            const intentResult: IntentDetectionResult = await intentService.detectIntent(
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