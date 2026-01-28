import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createDebugCallback } from '../../../utils/debug-callback';

// Enhanced input schema for general support with post context
const GeneralSupportInput = z.object({
    message: z.string().describe('The current user message requesting general support'),
    lastMessages: z.array(z.string()).max(5).describe('Previous conversation messages for context'),
    postTitle: z.string().optional().describe('Title of the current post for context'),
    postSummary: z.string().optional().describe('Summary of the current post for context'),
});

// Enhanced output schema for support responses
export const GeneralSupportOutput = z.object({
    response: z.string().min(20).describe('Friendly response to the user - can be a question or regular message'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct actions tailored to the post context')
});

// Enhanced system prompt with post context awareness
const ENHANCED_SYSTEM_PROMPT = `You are Qirata's friendly AI assistant. Help users understand what they can do on our platform.

QIRATA CAN HELP WITH:
- Understanding content: Ask questions about the related post and get explanations
- Creating social media posts: Generate posts for LinkedIn, Twitter, Instagram, etc.
- Editing posts: Refine and improve existing social media content

CURRENT POST CONTEXT:
When a post is available, use the title and summary to provide more relevant suggestions.
Tailor your suggested options to match the post's topic and potential social media opportunities.

YOUR ROLE:
- Be warm and friendly
- If it's their first message (no previous context), welcome them and explain capabilities
- If mid-conversation, build on context and avoid repetition
- Provide helpful responses and 3 short, direct suggested options TAILORED TO THE POST CONTENT
- When post context is available, suggest actions like:
  * "Ask questions about [specific post topic]"
  * "Create a LinkedIn post about [post theme]"
  * "Generate Twitter threads on [post insights]"
- Ask clarifying questions when needed

Keep responses concise and actionable for MVP.`;

export async function supportAgent(options: z.infer<typeof GeneralSupportInput>): Promise<z.infer<typeof GeneralSupportOutput>> {
    const supportTool = {
        name: "supportResponse",
        description: "Provide general support and assistance",
        schema: z.toJSONSchema(GeneralSupportOutput)
    };

    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.3,
        maxTokens: 350,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).bindTools([supportTool]);

    const isFirstMessage = options.lastMessages.length === 0;

    // Build post context information for tailored suggestions
    const postContext = options.postTitle || options.postSummary
        ? `\nCURRENT POST CONTEXT:
Title: ${options.postTitle || 'Not provided'}
Summary: ${options.postSummary || 'Not provided'}

Use this context to provide more relevant suggestions tailored to the post content.`
        : '';

    // Build conversation context from user messages only
    const conversationContext = isFirstMessage
        ? '\nThis is the user\'s first interaction. Welcome them and explain what Qirata can help with.'
        : `\nPrevious user messages: ${options.lastMessages.join(' → ')}
Build on their interests and avoid repetition.`;

    // Create message chain using proper LangChain message templates
    const messages = [
        new SystemMessage(ENHANCED_SYSTEM_PROMPT + postContext),
        new HumanMessage(`${conversationContext}

Current message: "${options.message}"

Provide helpful support as Qirata's AI assistant with suggestions tailored to the post context.`)
    ];

    const result = await model.invoke(messages, {
        callbacks: [createDebugCallback('general-support')]
    });

    // Extract tool call result
    const toolCall = result.tool_calls?.[0];
    if (!toolCall) {
        throw new Error('No tool call found in response');
    }

    // Validate with Zod and return
    return GeneralSupportOutput.parse(toolCall.args);
}