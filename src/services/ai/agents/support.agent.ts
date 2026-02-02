import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';

// Enhanced input schema for general support with post context
const GeneralSupportInput = z.object({
    message: z.string().describe('The current user message requesting general support'),
    lastMessages: z.array(z.string()).max(5).describe('Previous conversation messages for context'),
    postTitle: z.string().describe('Title of the current post for context'),
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
Use the title to provide more relevant suggestions.
Tailor your suggested options to match the post's topic and potential social media opportunities.

YOUR ROLE:
- Be warm and friendly
- If it's their first message (no previous context), welcome them and explain capabilities
- If mid-conversation, build on context and avoid repetition
- Provide helpful responses and 3 short, direct suggested options TAILORED TO THE POST
- Use the post title to suggest actions related
- Ask clarifying questions when needed

Keep responses concise and actionable for MVP.`;

export async function supportAgent(options: z.infer<typeof GeneralSupportInput>): Promise<z.infer<typeof GeneralSupportOutput>> {
    // Define the llm model
    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.3,
        maxTokens: 350,
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create the agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(GeneralSupportOutput)
    })

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [createDebugCallback('general-support')]
    });


    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof GeneralSupportInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];

    messages.push(new SystemMessage(ENHANCED_SYSTEM_PROMPT));

    // push post title
    messages.push(new HumanMessage(`Post Title: "${options.postTitle}"`));
    messages.push(new AIMessage("Received the post title"));

    // push post summary if available
    if (options.postSummary) {
        messages.push(new HumanMessage(`Post Summary: "${options.postSummary}"`));
        messages.push(new AIMessage("Received the post summary"));
    }

    // push old converstaion messages (interleaved user and AI messages)
    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg, index) => {
            messages.push(new HumanMessage(msg))
        })
    }
    messages.push(new AIMessage('I have the old messages and will maintain context.'))

    // push current user message
    messages.push(new HumanMessage(options.message))

    return messages;
}