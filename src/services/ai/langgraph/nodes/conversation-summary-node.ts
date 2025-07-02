import { logger } from '../../../../utils/logger';
import { generateConversationSummary } from '../../agents/conversation-summary.agent';
import { BaseNode, ChatState } from './base-node';

export class ConversationSummaryNode extends BaseNode {
    constructor() {
        super('ConversationSummary');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            // Log starting the node
            this.logInfo(`Starting ConversationSummaryNode ${state.sessionId}`);

            const summary = await generateConversationSummary({
                postSummary: state.postSummary,
                messages: state.previousMessages || [],
                existingSummary: state.conversationSummary || '',
            })

            // Log the generated summary
            this.logInfo(`Generated conversation summary for ${state.sessionId}: ${summary}`);

            return {
                conversationSummary: summary,
            };
        } catch (error) {
            this.logError('Conversation summary error', error, state.sessionId);

            return state;
        }
    }
}