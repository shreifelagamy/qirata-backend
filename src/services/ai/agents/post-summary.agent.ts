import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from "../../../utils/logger";

type SummarizeOptions = {
    postContent: string;
}

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an expert content analyst specialized in summarizing posts for conversational context. Your role is to create concise, actionable summaries that help AI assistants understand what users are discussing.

## Analysis Framework:

### Content Elements to Extract:
1. **Main Topic/Theme**: Core subject matter and primary focus
2. **Key Points**: Main arguments, insights, or information presented
3. **Industry/Domain Context**: Business sector, field, or area of expertise
4. **Tone and Style**: Communication approach (professional, casual, educational, opinion, etc.)
5. **Target Audience**: Implied or explicit audience characteristics
6. **Platform Context**: Any specific social media platforms or contexts mentioned
7. **Notable Elements**: Hashtags, mentions, keywords, or special formatting
8. **Content Type**: Format and purpose (announcement, question, advice, news, personal experience, etc.)

### Summary Requirements:
- **Length**: 3-4 concise sentences maximum
- **Focus**: Actionable context for future conversations
- **Clarity**: Clear, informative, and easily digestible
- **Relevance**: Highlight elements that will help personalize future interactions

### Quality Guidelines:
- Capture the essence and intent of the original content
- Maintain objectivity while noting tone and style
- Include contextual details that aid conversation flow
- Avoid unnecessary detail while preserving key insights
- Structure information for easy AI comprehension`;

async function summarizePostAgent(options: SummarizeOptions): Promise<string> {
    const model = new ChatOpenAI({ model: 'gpt-4.1-mini', temperature: 0.7, openAIApiKey: process.env.OPENAI_API_KEY })

    const { postContent } = options;

    if (!postContent || postContent.trim().length === 0) {
        logger.warn('Empty post content provided for summarization');
        return 'No post content available for context.';
    }

    try {
        logger.info('Generating post summary for context');

        // Build messages array
        const messages = buildMessagesArray(postContent);

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        // Create debug callback
        const debugCallback = createDebugCallback('post-summary');

        const summary = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        logger.info('Post summary generated successfully');
        return summary;

    } catch (error) {
        logger.error('Failed to generate post summary:', error);
        return `Post content available but summary failed. Content preview: ${postContent.substring(0, 100)}...`;
    }
}

// Helper function to build messages array for prompt
function buildMessagesArray(postContent: string): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // Static system message (cacheable)
    messages.push(new SystemMessage(SYSTEM_MESSAGE));

    // Post content as user message
    messages.push(new HumanMessage(`Please analyze and summarize the following post content:

<POST_CONTENT>
${postContent.trim()}
</POST_CONTENT>

Provide a concise 3-4 sentence summary following the analysis framework outlined in your instructions.`));

    return messages;
}

export default summarizePostAgent