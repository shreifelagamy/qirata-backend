import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createDebugCallback } from '../../../utils/debug-callback';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';


// Input schema for post Q&A
const PostQAInput = z.object({
    message: z.string().describe('The user question about the post'),
    lastMessages: z.array(z.string()).max(10).describe('Last 10 conversation messages for context'),
    postSummary: z.string().describe('Summary of the post content'),
    conversationSummary: z.string().optional().describe('Summary of previous conversation if available'),
    fullPostContent: z.string().optional().describe('Full post content if needed for detailed answers')
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
- **Post summary**: Use for general questions and overviews
- **Full content**: Request when user asks for specific details, examples, or technical explanations
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
- Start with an **engaging opening** that validates the question
- **Bold key terms** throughout your explanation
- Use **bullet points or numbered lists** when explaining multiple concepts
- Structure complex ideas with **clear headings** or **bold topic sentences**
- Apply formatting consistently to create **visual learning anchors**
- End your main explanation cleanly, then optionally add a natural follow-up question

## OUTPUT FORMAT:
- Provide your complete educational explanation
- End with a natural, conversational follow-up question when appropriate (e.g., "Would you like examples of specific tools used in these measurements?")
- Always include 3 short, direct follow-up questions related to the post content in the \`suggestedOptions\` JSON field
- Keep the tone natural and engaging throughout`;

export async function postQAAgent(options: z.infer<typeof PostQAInput>): Promise<z.infer<typeof PostQAOutput>> {
    // Create tool from Zod schema
    const postQATool = {
        name: "postQAResponse",
        description: "Provide an answer to a post-related question with code blocks allowed",
        schema: zodToJsonSchema(PostQAOutput)
    };

    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        maxTokens: 1500,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).bindTools([postQATool]);

    // Build context from conversation history
    const messages = []
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT))

    // push the post summary
    messages.push(new HumanMessage(`<POST_SUMMARY>${options.postSummary}</POST_SUMMARY>`))
    messages.push(new AIMessage("Recived the post summary"))

    // push old converstaion summary
    if( options.conversationSummary) {
        messages.push(new HumanMessage(`<CONVERSATION_SUMMARY>${options.conversationSummary}</CONVERSATION_SUMMARY>`))
        messages.push(new AIMessage("Recived the conversation summary"))
    }

    // push post content
    if(options.fullPostContent) {
        messages.push(new HumanMessage(`<FULL_POST_CONTENT>${options.fullPostContent}</FULL_POST_CONTENT>`))
        messages.push(new AIMessage("Recived the full post content"))
    }

    // push old messages
    if ( options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg, index) => {
            messages.push(new HumanMessage(msg))
        })
        messages.push(new AIMessage('I have the old messages and will maintain context.'))
    }

    messages.push(new HumanMessage(options.message))

    const result = await model.invoke(messages, {
        callbacks: [
            createDebugCallback('post-qa')
        ]
    });

    // Extract tool call result
    const toolCall = result.tool_calls?.[0];
    if (!toolCall) {
        throw new Error('No tool call found in response');
    }

    // Validate with Zod and return
    return PostQAOutput.parse(toolCall.args);
}