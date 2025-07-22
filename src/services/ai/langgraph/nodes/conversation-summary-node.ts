import { logger } from '../../../../utils/logger';
import { generateConversationSummary } from '../../agents/conversation-summary.agent';
import { BaseNode, ChatState } from './base-node';

const MESSAGE_THRESHOLD = 5; // Trigger summary every 5 messages
const KEEP_RECENT = 8; // Keep last 8 messages after summarization

export class ConversationSummaryNode extends BaseNode {
    constructor() {
        super('ConversationSummary');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            // Log starting the node
            this.logInfo(`Starting ConversationSummaryNode ${state.sessionId}`);

            const messages = state.previousMessages || [];
            const totalMessageCount = state.totalMessageCount || 0;

            // Business logic: Check if summarization is needed based on total message count
            if (!this.shouldSummarize(totalMessageCount)) {
                this.logInfo(`Not enough messages for summarization ${totalMessageCount}, skipping summary generation.`);
                return {
                    conversationSummary: state.conversationSummary || ''
                };
            }

            // Slice messages to keep only recent ones for summarization
            const recentMessages = messages.slice(-KEEP_RECENT);

            const summary = await generateConversationSummary({
                postSummary: state.postSummary,
                messages: recentMessages,
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

    // Business logic: Check if summarization is needed
    private shouldSummarize(messageCount: number): boolean {
        this.logInfo(`Checking if summarization is needed for ${messageCount} messages: ${messageCount >= MESSAGE_THRESHOLD} && ${messageCount % MESSAGE_THRESHOLD === 0}`);
        return messageCount >= MESSAGE_THRESHOLD && messageCount % MESSAGE_THRESHOLD === 0;
    }
}