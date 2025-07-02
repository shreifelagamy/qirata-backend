import { detectIntent } from '../../agents/intent-detection.agent';
import { BaseNode, ChatState } from './base-node';

export class IntentDetectionNode extends BaseNode {
    constructor() {
        super('IntentDetection');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo(`Detecting intent ${state.sessionId}`);

            if (!state.models?.intentDetection) {
                throw new Error('Intent detection model not available in state');
            }

            const intent = await detectIntent({
                message: state.userMessage,
                conversationHistory: state.previousMessages || [],
            });

            // log intent output
            this.logInfo(`Detected intent: ${intent.intent} with confidence ${intent.confidence} with reasoning: ${intent.reasoning}`);

            return { intent };
        } catch (error) {
            this.logError('Intent detection error', error, state.sessionId);
            return this.handleError('Intent detection', error);
        }
    }
}