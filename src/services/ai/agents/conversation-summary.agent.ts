import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from "@langchain/ollama";
import { Message } from "../../../entities";
import { logger } from "../../../utils/logger";

const MESSAGE_THRESHOLD = 2; // Trigger summary every 2 messages
const KEEP_RECENT = 8; // Keep last 8 messages after summarization

const CONVERSATION_SUMMARY_PROMPT = `
<POST_SUMMARY>
{post_summary}
</POST_SUMMARY>

<PREVIOUS_SUMMARY>
{existing_summary}
</PREVIOUS_SUMMARY>

<RECENT_CONVERSATION>
{recent_messages}
</RECENT_CONVERSATION>

Summarize this conversation focusing on:
- Main topics discussed about the content in relation to the post summary
- Key questions asked and insights shared
- Social media platform preferences mentioned (Twitter, LinkedIn, Instagram, etc.)
- Content sharing requests and outcomes
- User's engagement patterns and interests
- Important context for future interactions

Keep the summary concise but preserve context for personalized responses.
Format as a brief, coherent paragraph.

Summary:`;

interface ConversationSummaryOptions {
    model?: ChatOllama;
    messages: Message[];
    existingSummary: string;
    postSummary?: string;
}

export async function generateConversationSummary(options: ConversationSummaryOptions): Promise<string> {
    const {
        model = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'mistral:7b', temperature: 0.5 }),
        messages,
        existingSummary,
        postSummary
    } = options;

    // Only summarize if we have enough messages
    if (!shouldSummarize(messages.length, MESSAGE_THRESHOLD)) {
        logger.info(`Not enough messages for summarization ${messages.length}, skipping summary generation.`);
        return existingSummary || '';
    }

    try {

        const prompt = ChatPromptTemplate.fromTemplate(CONVERSATION_SUMMARY_PROMPT);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        // Format recent messages for context
        const recentMessages = formatMessages(messages);

        const summary = await chain.invoke({
            post_summary: postSummary || "No post summary available",
            existing_summary: existingSummary || "Beginning of conversation",
            recent_messages: recentMessages
        });

        return summary;

    } catch (error) {
        logger.error('Failed to generate conversation summary:', error);
        return existingSummary || 'Summary generation failed';
    }
}

// Helper function to check if summarization is needed
function shouldSummarize(messageCount: number, threshold: number = 6): boolean {
    return messageCount >= threshold && messageCount % threshold === 0;
}

// Helper function to format messages
function formatMessages(messages: Message[]): string {
    const formattedMessages = messages
        .slice(-KEEP_RECENT) // Use last 8 messages for context
        .map(msg => `User: ${msg.user_message}\nAssistant: ${msg.ai_response}`)
        .filter(msg => msg.trim() !== ''); // Remove empty messages

    if (formattedMessages.length === 0) {
        return 'No previous conversation history.';
    }

    return formattedMessages.join('\n\n---\n\n');
}