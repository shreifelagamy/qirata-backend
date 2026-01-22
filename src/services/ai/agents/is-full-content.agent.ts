import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

type IsFullContentOptions = {
    title: string;
    content: string;
};

type IsFullContentResult = {
    isFull: boolean;
    confidence: number;
    reason: string;
};

const SYSTEM_MESSAGE = `You are an expert at analyzing RSS feed content to determine if it contains the full article or just a teaser/summary.

## Your Task
Analyze the provided content and determine if it's the FULL article or just a TEASER/PREVIEW.

## Signs of TEASER/INCOMPLETE content:
- Very short (just 1-3 sentences describing a topic)
- Contains phrases like "The post X appeared first on Y" (RSS feed footer)
- Contains newsletter signup prompts ("Join the X Newsletter")
- Promotional calls-to-action at the end
- References images/screenshots that contain the actual content
- Promises details that aren't delivered in the text
- Title promises specific information but content only gives a vague overview

## Signs of FULL content:
- Multiple paragraphs with substantial information
- Code examples (if technical article)
- Step-by-step instructions or detailed explanations
- Complete thoughts and conclusions
- No abrupt endings or "read more" indicators

## Response Format
You must respond with valid JSON only, no other text:
{
    "isFull": boolean,
    "confidence": number (0.0 to 1.0),
    "reason": "brief explanation"
}`;

const responseSchema = z.object({
    isFull: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string()
});

async function isFullContentAgent(options: IsFullContentOptions): Promise<IsFullContentResult> {
    const { title, content } = options;

    if (!content || content.trim().length === 0) {
        return {
            isFull: false,
            confidence: 1.0,
            reason: 'No content provided'
        };
    }

    // Quick heuristic: very short content is definitely not full
    const textOnly = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (textOnly.length < 200) {
        return {
            isFull: false,
            confidence: 0.95,
            reason: 'Content too short to be a full article'
        };
    }

    try {
        logger.info('Evaluating content completeness with AI');

        const model = new ChatOpenAI({
            model: 'gpt-5-mini',
            openAIApiKey: process.env.OPENAI_API_KEY
        });

        const messages = buildMessagesArray(title, content);
        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model);

        const debugCallback = createDebugCallback('is-full-content');

        const response = await chain.invoke({}, {
            callbacks: [debugCallback]
        });

        const responseText = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        const parsed = JSON.parse(responseText);
        const result = responseSchema.parse(parsed);

        logger.info(`Content completeness: isFull=${result.isFull}, confidence=${result.confidence}, reason=${result.reason}`);

        return result;
    } catch (error) {
        logger.error('Failed to evaluate content completeness:', error);
        // Default to false (fetch full content) on error - safer option
        return {
            isFull: false,
            confidence: 0.5,
            reason: 'Evaluation failed, defaulting to fetch full content'
        };
    }
}

function buildMessagesArray(title: string, content: string): BaseMessage[] {
    const messages: BaseMessage[] = [];

    messages.push(new SystemMessage(SYSTEM_MESSAGE));

    messages.push(new HumanMessage(`Analyze this RSS content and determine if it's the full article or just a teaser:

**Title:** ${title}

**Content:**
${content.trim()}`));

    return messages;
}

export default isFullContentAgent;
