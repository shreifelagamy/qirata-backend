import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';

// Input schema for post selector
const SocialPostSelectorInput = z.object({
    message: z.string().describe('The current user message'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    socialPostsHistory: z.array(z.object({
        id: z.string(),
        platform: z.enum(['twitter', 'linkedin']),
        content: z.string(),
        codeExamples: z.array(z.object({
            language: z.string(),
            code: z.string(),
            description: z.string().nullable(),
        })).nullable(),
    })).describe('Available social posts in the session'),
});

// Output schema for post selector
export const SocialPostSelectorOutput = z.object({
    selectedPostId: z.string()
        .nullable()
        .describe('The ID of the selected post, or null if unable to determine'),
    message: z.string()
        .describe('Response message: confirmation if post found, or question asking user to pick'),
    suggestedOptions: z.array(z.string())
        .describe('Post options for the user to select from when post cannot be determined. Empty if post was identified.'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    reasoning: z.string().describe('Brief explanation for the selection decision'),
});

const CACHED_SYSTEM_PROMPT = `You are Qirata's social post selector.

Task: Determine which social post the user wants to edit from the available posts.

You will receive:
- The user's current message
- Conversation history for context
- A list of available social posts (each with id, platform, content, and optional code examples)

Output selectedPostId when:
- The user explicitly references a post by platform AND there is only one post on that platform (e.g. "edit the Twitter post" when only one Twitter post exists)
- The user references specific post content or code examples that clearly match one post (e.g. "the one about React hooks", "the post with the Python snippet")
- The conversation context makes it obvious which post they mean (e.g. they just created a post and immediately say "make it shorter")

Output selectedPostId = null when:
- Multiple posts exist and the user's message is ambiguous (e.g. "edit the post", "change it")
- The user references a platform but multiple posts exist on that platform (e.g. "edit the Twitter post" when there are 2 Twitter posts)
- You cannot confidently determine which post the user refers to

When post is identified:
- Set selectedPostId to the post's ID
- Set message to a short confirmation (e.g. "Got it, editing your Twitter post about React hooks.")
- Set suggestedOptions to an empty array

When post cannot be determined:
- Set selectedPostId to null
- Set message to a question asking the user to specify which post
- Set suggestedOptions to short descriptions of each post (e.g. "Twitter: React hooks tips...", "LinkedIn: Career growth...")
  - Each option should be: "<Platform>: <first ~40 chars of content>..."

Rules:
- Only select a post when you are confident about the user's intent.
- Use conversation history to resolve references like "the first one" or "the last post".
- Consider code examples as part of the post identity — users may refer to posts by their code content.
- Handle Arabic references as well.
- Truncate post content in suggested options to keep them short and readable.`;

export default async function socialPostSelectorAgent(options: z.infer<typeof SocialPostSelectorInput>): Promise<z.infer<typeof SocialPostSelectorOutput>> {
    const model = new ChatOpenAI({
        model: 'gpt-5-mini',
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialPostSelectorOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('social-post-selector')
        ]
    });

    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof SocialPostSelectorInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg.user_message));
            messages.push(new AIMessage(msg.ai_response));
        });
    }

    // Provide available posts as context (including code examples)
    const postsContext = options.socialPostsHistory.map((post, i) => {
        let postStr = `Post ${i + 1} [ID: ${post.id}] (${post.platform}): ${post.content}`;
        if (post.codeExamples && post.codeExamples.length > 0) {
            const codeStr = post.codeExamples.map(ce =>
                `  - Code (${ce.language}): ${ce.description || ce.code.slice(0, 60)}`
            ).join('\n');
            postStr += `\n  Code examples:\n${codeStr}`;
        }
        return postStr;
    }).join('\n\n');

    messages.push(new AIMessage(`Available social posts:\n${postsContext}\n\nI will determine which post the user wants to edit.`));
    messages.push(new HumanMessage(options.message));

    return messages;
}
