import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent, toolStrategy } from 'langchain';
import * as z from 'zod';
import { createDebugCallback } from '../../../utils/debug-callback';


// Input schema for post Q&A
const PostQAInput = z.object({
    message: z.string().describe('The user question about the post'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(5).describe('Last 5 conversation message pairs (10 total messages) for context'),
    conversationSummary: z.string().optional().describe('Summary of previous conversation if available'),
    postSummary: z.string().describe('Summary of the post content'),
    postContent: z.string().describe('Full post content if needed for detailed answers')
});

// Simple output schema matching other agents
export const PostQAOutput = z.object({
    response: z.string().min(30).describe('markdown answer to the user question based on post content'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct follow-up questions related to the post content')
});

// Cached system prompt for post Q&A
const CACHED_SYSTEM_PROMPT = `
You are Qirata’s post Q&A assistant with a teaching-focused approach.

Goal:
- Answer the user’s question using the provided post context.
- Guide understanding: break down complex concepts and use analogies if helpful.
- Stay concise, practical, and encouraging.

Source-of-truth:
- Use POST_SUMMARY and POST_CONTENT as primary sources.
- STRICT RULE: Only answer questions that can be answered from the provided post content.
- If the question cannot be confidently answered using the post content, respond with a polite message like: "The post doesn't seem to cover this topic. Try asking something specific to the post's content!" and adjust suggestedOptions to guide the user back to relevant post topics.

Style:
- Clear, direct, but friendly (teacher-like voice).
- Use Markdown: Bold key terms/numbers, Italicize jargon.

Output requirements:
- Return JSON:
  1) 'response': the full answer (140–220 words).
  2) 'suggestedOptions': exactly 3 short follow-up questions.
     * Logic: If conversation depth > 3 turns, replace one option with "Create a social post to share this".

Quality checks:
- Ensure 'response' is non-empty and specific to the user question.
- Ensure suggested options are distinct and actionable.`;

export async function postQAAgent(options: z.infer<typeof PostQAInput>): Promise<z.infer<typeof PostQAOutput>> {
    // Define the chat model
    const model = new ChatOpenAI({
        model: 'gpt-5.2',
        reasoning: {
            effort: 'medium'
        },
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(PostQAOutput)
    })

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('post-qa')
        ]
    });

    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof PostQAInput>): BaseMessage[] {
    const messages = []

    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT))

    // // push the post summary
    // messages.push(new HumanMessage(`<POST_SUMMARY>${options.postSummary}</POST_SUMMARY>`))
    // messages.push(new AIMessage("Recived the post summary"))

    // push old converstaion summary
    if (options.conversationSummary) {
        messages.push(new HumanMessage(`<CONVERSATION_SUMMARY>${options.conversationSummary}</CONVERSATION_SUMMARY>`))
        messages.push(new AIMessage("Recived the conversation summary"))
    }

    // push post content
    if (options.postContent) {
        messages.push(new HumanMessage(`<POST_CONTENT>${options.postContent}</POST_CONTENT>`))
        messages.push(new AIMessage("Received the post content"))
    }

    // push old conversation messages (interleaved user and AI messages)
    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg.user_message))
            messages.push(new AIMessage(msg.ai_response))
        })
    }

    messages.push(new HumanMessage(options.message))

    return messages;
}