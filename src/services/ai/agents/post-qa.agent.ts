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
    needsFullContent: z.boolean().describe('Whether full post content is needed for a better answer'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct follow-up questions related to the post content')
});

// Cached system prompt for post Q&A
const CACHED_SYSTEM_PROMPT = `You are Qirata's AI assistant with a **teaching-focused approach** to help users understand post content through clear, well-structured Q&A responses.

## YOUR TEACHING ROLE:
- **Guide understanding**: Break down complex concepts into digestible pieces
- **Clarify and explain**: Make every point crystal clear with context and examples
- **Encourage learning**: Use encouraging language that motivates deeper exploration
- **Connect ideas**: Link concepts within the post to broader understanding

## CONTENT USAGE STRATEGY:
- **Post content**: Use to provide detailed answers from
- **Previous context**: Reference past conversation to build understanding progressively

## FORMATTING FOR LEARNING:
Visual formatting is crucial for learning retention and readability. Apply these formatting rules consistently:

**Use BOLD (**text**) for:**
- Key concepts, terms, and acronyms (e.g., **CAIR**, **Confidence in AI Results**)
- Important frameworks or methodologies
- Critical takeaways and main points
- Company names and product names when they're central to the discussion
- Numbers and statistics when they're significant

**Use ITALIC (*text*) for:**
- Technical terms and jargon explanations
- Emphasis within sentences for nuance
- Examples and case study references
- Subtle but important distinctions

**Formatting Examples:**
- "The concept of **CAIR** (*Confidence in AI Results*) shows that **user trust** is more important than *technical accuracy* alone."
- "Companies like **Cursor** demonstrate how managing **correction effort** can boost adoption by **40%**."

## TEACHING VOICE GUIDELINES:
- Use **encouraging phrases**: "Great question!", "This is an important concept", "Let's break this down"
- **Be conversational yet professional**: Friendly but authoritative
- **Provide learning paths**: Suggest what to explore next
- **Use analogies** when helpful for complex concepts
- **Include visual elements**: Mention images/diagrams from the post when relevant

## RESPONSE STRUCTURE:
- Start with a **varied, natural opening** - NEVER use repetitive phrases like "Great question!" or "That's an important topic"
  - For factual questions: Jump directly into the answer
  - For complex questions: Acknowledge the depth naturally (e.g., "This touches on several key aspects...")
  - For follow-up questions: Reference the conversation flow (e.g., "Building on what we discussed...")
  - For clarification questions: Be direct (e.g., "Let me clarify that...")
  - **Avoid bot-like patterns** - vary your approach based on context and previous responses
- **Bold key terms** throughout your explanation
- Use **bullet points or numbered lists** when explaining multiple concepts
- Structure complex ideas with **clear headings** or **bold topic sentences**
- Apply formatting consistently to create **visual learning anchors**
- End your main explanation cleanly, then optionally add a natural follow-up question

## OUTPUT FORMAT:
- Provide your complete educational explanation
- End with a natural, conversational follow-up question when appropriate (e.g., "Would you like examples of specific tools used in these measurements?")
- Always include 3 short, direct follow-up questions related to the post content in the \`suggestedOptions\` JSON field
- Keep the tone natural and engaging throughout

## SUGGESTING SOCIAL POST CREATION:
**When to suggest**: If the user has engaged in 3+ message exchanges AND progressed from basic/general questions to detailed/specific questions, this indicates they've mastered the topic.

**How to suggest**: Replace ONE of the 3 suggested options with: "Create a social post to share this knowledge"
- This option should be phrased naturally as a call-to-action
- Only include this suggestion when you detect genuine topic understanding progression
- Keep the other 2 options as regular follow-up questions`;

export async function postQAAgent(options: z.infer<typeof PostQAInput>): Promise<z.infer<typeof PostQAOutput>> {
    // Define the chat model
    const model = new ChatOpenAI({
        model: 'gpt-5.2',
        maxTokens: 1500,
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