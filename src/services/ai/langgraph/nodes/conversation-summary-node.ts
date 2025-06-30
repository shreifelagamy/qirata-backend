import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIContext } from '../../../../types/ai.types';
import { BaseNode, ChatState } from './base-node';

export class ConversationSummaryNode extends BaseNode {
    private readonly SUMMARY_PROMPT = `
Previous summary: {existing_summary}
Recent conversation: {recent_messages}

Summarize this conversation focusing on:
- Main topics discussed about the content
- Key questions asked and insights shared
- Social media platform preferences mentioned (Twitter, LinkedIn, Instagram, etc.)
- Content sharing requests and outcomes
- User's engagement patterns and interests
- Important context for future interactions

Keep the summary concise but preserve context for personalized responses.
Format as a brief, coherent paragraph.

Summary:`;

    private readonly MESSAGE_THRESHOLD = 6; // Trigger summary every 6 messages
    private readonly KEEP_RECENT = 2; // Keep last 2 messages after summarization

    constructor() {
        super('ConversationSummary');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Processing conversation summary', state.sessionId);

            const messages = state.previousMessages || [];

            // Build context regardless of summarization
            const context: AIContext = {
                postContent: state.postContent,
                previousMessages: state.previousMessages,
                conversationSummary: state.conversationSummary,
                userPreferences: state.userPreferences
            };

            // Only summarize if we have enough messages
            if (this.shouldSummarize(messages.length, this.MESSAGE_THRESHOLD) === false) {
                this.logInfo('Not enough messages for summarization', state.sessionId);
                return {
                    context,
                    processingTime: Date.now()
                };
            }

            this.logInfo(`Summarizing conversation with ${messages.length} messages`, state.sessionId);
            // Generate new summary
            const summary = await this.generateSummary(messages, state.conversationSummary, state.models?.memoryService);

            // Update context with new summary
            const updatedContext: AIContext = {
                ...context,
                conversationSummary: summary,
                previousMessages: messages.slice(-this.KEEP_RECENT) // Keep only recent messages
            };

            this.logInfo('Conversation summary generated successfully', summary);

            return {
                context: updatedContext,
                conversationSummary: summary,
                previousMessages: messages.slice(-this.KEEP_RECENT),
                processingTime: Date.now()
            };
        } catch (error) {
            this.logError('Conversation summary error', error, state.sessionId);

            // Fallback: return context without summarization
            const context: AIContext = {
                postContent: state.postContent,
                previousMessages: state.previousMessages,
                conversationSummary: state.conversationSummary,
                userPreferences: state.userPreferences
            };

            return {
                context,
                processingTime: Date.now(),
                error: `Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    private async generateSummary(messages: any[], existingSummary?: string, memoryModel?: any): Promise<string> {
        if (!memoryModel) {
            throw new Error('Memory service model not available in state');
        }

        const prompt = ChatPromptTemplate.fromTemplate(this.SUMMARY_PROMPT);
        const chain = prompt.pipe(memoryModel).pipe(new StringOutputParser());

        const recentMessages = this.formatMessages(messages);

        const summary = await chain.invoke({
            existing_summary: existingSummary || "Beginning of conversation",
            recent_messages: recentMessages
        });

        return summary.trim();
    }

    private formatMessages(messages: any[]): string {
        return messages
            .slice(-8) // Use last 8 messages for context
            .map(msg => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                const content = msg.content?.substring(0, 200) || ''; // Limit content length
                return `${role}: ${content}`;
            })
            .join('\n');
    }

    // Helper method to check if summarization is needed
    shouldSummarize(messageCount: number, threshold: number = 6): boolean {
        return messageCount >= threshold && messageCount % threshold === 0;
    }
}