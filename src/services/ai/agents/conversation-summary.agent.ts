import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from "@langchain/ollama";
import { Message } from "../../../entities";
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from "../../../utils/logger";

const MESSAGE_THRESHOLD = 5; // Trigger summary every 2 messages
const KEEP_RECENT = 8; // Keep last 8 messages after summarization

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an expert conversation analyst specialized in creating contextual summaries for ongoing AI interactions. Your role is to synthesize conversation history with post context to maintain continuity in future interactions.

## Summarization Framework:

### Key Elements to Capture:
1. **Content Discussion**: Main topics discussed in relation to the original post
2. **User Engagement**: Questions asked, insights shared, and interaction patterns
3. **Platform Preferences**: Social media platforms mentioned or preferred
4. **Content Requests**: Social post generation requests and outcomes
5. **User Interests**: Emerging themes, preferences, and engagement styles
6. **Conversation Flow**: Important context that aids future interactions

### Summary Requirements:
- **Format**: Brief, coherent paragraph
- **Length**: Concise yet comprehensive
- **Focus**: Preserve context for personalized future responses
- **Integration**: Connect conversation topics with original post context
- **Continuity**: Enable smooth continuation of discussions

### Quality Guidelines:
- Maintain chronological flow of important events
- Highlight user preferences and patterns
- Connect discussion points to original content
- Preserve context that enables personalized responses
- Balance brevity with contextual richness
- Focus on actionable insights for future interactions`;

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
        logger.info('Generating conversation summary');

        // Build messages array with conversation history
        const messageArray = buildMessagesArray(messages, existingSummary, postSummary);

        const prompt = ChatPromptTemplate.fromMessages(messageArray);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        // Create debug callback
        const debugCallback = createDebugCallback('conversation-summary');

        const summary = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        logger.info('Conversation summary generated successfully');
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

// Helper function to build messages array for prompt
function buildMessagesArray(messages: Message[], existingSummary: string, postSummary?: string): BaseMessage[] {
    const messageArray: BaseMessage[] = [];

    // Static system message (cacheable)
    messageArray.push(new SystemMessage(SYSTEM_MESSAGE));

    // Add post summary as context if available
    if (postSummary?.trim()) {
        messageArray.push(new HumanMessage(`<POST_SUMMARY>\n${postSummary}\n</POST_SUMMARY>`));
        messageArray.push(new AIMessage('I have the post summary and will use it as context for the conversation summary.'));
    }

    // Add existing summary if available
    if (existingSummary?.trim() && existingSummary !== 'Beginning of conversation') {
        messageArray.push(new HumanMessage(`<PREVIOUS_SUMMARY>\n${existingSummary}\n</PREVIOUS_SUMMARY>`));
        messageArray.push(new AIMessage('I have the previous conversation summary and will build upon it.'));
    }

    // Add recent conversation messages
    const recentMessages = messages.slice(-KEEP_RECENT);

    for (const msg of recentMessages) {
        if (msg.user_message?.trim()) {
            messageArray.push(new HumanMessage(msg.user_message));
        }
        if (msg.ai_response?.trim()) {
            messageArray.push(new AIMessage(msg.ai_response));
        }
    }

    // Request for summary
    messageArray.push(new HumanMessage(`Please create a conversation summary following the framework outlined in your instructions. Focus on main topics discussed, user engagement patterns, platform preferences, content requests, and important context for future interactions.

Format as a brief, coherent paragraph that will help maintain continuity in future conversations.`));

    return messageArray;
}