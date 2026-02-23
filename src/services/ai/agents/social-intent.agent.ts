import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';

const SocialIntentInput = z.object({
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    message: z.string().describe('The current user message'),
});

export const SocialIntentActionList = z.enum(['CREATE', 'EDIT']);

export const SocialIntentOutput = z.object({
    action: SocialIntentActionList.describe('Whether the user wants to create a new social post or edit an existing one'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    reasoning: z.string().describe('Brief explanation for the classification decision'),
});

const CACHED_SYSTEM_PROMPT = `You are a social post intent classifier for Qirata.

Task: Based on the conversation history, determine whether the user wants to CREATE a new social post or EDIT an existing one.

Output "CREATE" when:
- The user asks to write, generate, or draft a new social post.

Output "EDIT" when:
- The user wants to change, improve, rewrite, shorten, expand, or adjust a post that already exists in the conversation.
- The user references a previously generated post (e.g. "make it shorter", "change the tone", "add hashtags").
- The user says "try again" or "redo it" referring to an earlier post.

Rules:
- Use the conversation history to determine the user's intent.
- If no prior post exists in the conversation, always output "CREATE".
- Set confidence between 0 and 1 based on how clear the intent is.
- Provide a brief reasoning explaining why you chose CREATE or EDIT.`;

export default async function socialIntentAgent(options: z.infer<typeof SocialIntentInput>): Promise<z.infer<typeof SocialIntentOutput>> {
    const model = new ChatOpenAI({
        model: 'gpt-5-mini',
        reasoning: {
            effort: "low"
        },
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialIntentOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('social-action')
        ]
    });

    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof SocialIntentInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg.user_message));
            messages.push(new AIMessage(msg.ai_response));
        });
    }

    messages.push(new AIMessage('I will use prior messages for context and continuity.'));
    messages.push(new HumanMessage(options.message));

    return messages;
}
