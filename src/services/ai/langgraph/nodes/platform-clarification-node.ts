import { BaseNode, ChatState } from './base-node';

export class PlatformClarificationNode extends BaseNode {
    constructor() {
        super('PlatformClarification');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Generating platform clarification', state.sessionId);
            state.callback?.({
                event: 'token',
                sessionId: state.sessionId,
                token: state.platformDetection?.clarificationQuery,
            });

            return {
                aiResponse: state.platformDetection?.clarificationQuery,
                responseType: 'platform_clarification',
                isSocialPost: false
            };
        } catch (error) {
            this.logError('Platform clarification error', error, state.sessionId);
            return this.handleError('Platform clarification', error);
        }
    }
}