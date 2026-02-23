import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createDebugCallback } from '../../../utils/debug-callback';
import { createAgent, toolStrategy } from 'langchain';

// Input schema for social post editing
const SocialPostEditInput = z.object({
    message: z.string().describe('The current user message requesting social post editing'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    targetSocialPost: z.object({
        id: z.string(),
        platform: z.enum(['twitter', 'linkedin']),
        content: z.string(),
        codeExamples: z.array(z.object({
            language: z.string(),
            code: z.string(),
            description: z.string().nullable(),
        })).nullable(),
    }).describe('The specific social post to edit'),
    postContent: z.string().nullable().describe('Original article content (optional, for adding new information)'),
    socialMediaContentPreferences: z.string().nullable().describe('User preferences for social media content style')
});

// Output schema for social post editing
export const SocialPostEditOutput = z.object({
    message: z.string().describe('Response message to the user about the edited post'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct actions relevant to the edited post'),
    structuredPost: z.object({
        postContent: z.string().describe('Updated text content for the social media post'),
        codeExamples: z.array(z.object({
            language: z.string().describe('Programming language'),
            code: z.string().describe('The actual code content'),
            description: z.string().nullable().describe('Optional explanation of the code')
        })).nullable().describe('Optional array of code snippets'),
        visualElements: z.array(z.object({
            type: z.string().describe('Type of visual'),
            description: z.string().describe('Detailed description of the visual to create'),
            content: z.string().describe('Text content or data for the visual'),
            style: z.string().describe('Visual style preferences')
        })).nullable().describe('Optional array of visual elements to create')
    }).describe('Updated structured social post content')
});

const CACHED_SYSTEM_PROMPT = `You are Qirata's social media content editor.

Task: Edit an existing social media post based on the user's specific request while preserving all unchanged elements.

You will receive:
- The target social post to edit (with content and optional code examples)
- The user's edit request
- Conversation history for context
- Optionally: the original article content and user content preferences

Apply the requested changes when:
- The user explicitly asks to modify content (e.g. "make it shorter", "change the intro", "add emoji")
- The user asks to modify code examples (e.g. "change the code to Python", "fix the code", "remove the code")
- The user asks to adjust tone, style, or formatting

Preserve unchanged elements when:
- The user doesn't mention tone — keep the original tone
- The user doesn't mention hashtags — keep the original hashtags
- The user doesn't mention code — keep existing code examples as-is
- The user doesn't mention visuals — keep existing visual elements
- When in doubt, preserve the original and apply minimal changes

Platform rules (apply strict adherence):
- Twitter: Must stay under 280 characters, 1-3 hashtags. Concise, engaging, hashtag-friendly.
- LinkedIn: Aim for 1300-1600 characters, 3-5 hashtags. Professional, thoughtful, industry insights.
- Preserve platform-specific formatting unless user requests changes.

Code examples — critical rules:
- NEVER include code in postContent — ALL code MUST go in structuredPost.codeExamples array
- Exception: Only include code in postContent if the user EXPLICITLY requests it
- When adding code: Extract into separate objects with language, code, and description
- When editing code: Apply changes only to specified code snippets
- Support languages: javascript, python, sql, html, css, typescript, go, rust, java, etc.

Visual elements:
- Modify only the visual elements mentioned in the edit request
- Preserve existing visual elements unless asked to remove them

Content separation rules:
- Main social media text goes in structuredPost.postContent only
- All code examples go in structuredPost.codeExamples array
- All visual descriptions go in structuredPost.visualElements array

Rules:
- Apply ONLY the changes explicitly requested by the user.
- Handle Arabic edit requests as well.
- Keep responses focused and provide 3 short, direct, actionable next steps.`;

export default async function socialPostEditAgent(options: z.infer<typeof SocialPostEditInput>): Promise<z.infer<typeof SocialPostEditOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-5.2',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialPostEditOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('social-post-edit')
        ]
    });

    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof SocialPostEditInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    // Add user preferences if available
    if (options.socialMediaContentPreferences?.trim()) {
        messages.push(new AIMessage('User content preferences:'));
        messages.push(new HumanMessage(options.socialMediaContentPreferences));
    }

    // Add the post to edit (including code examples)
    let postContext = `Platform: ${options.targetSocialPost.platform}\nPost ID: ${options.targetSocialPost.id}\n\nContent:\n${options.targetSocialPost.content}`;

    if (options.targetSocialPost.codeExamples && options.targetSocialPost.codeExamples.length > 0) {
        const codeStr = options.targetSocialPost.codeExamples.map((ce, i) =>
            `Code ${i + 1} (${ce.language}):\n${ce.code}${ce.description ? `\nDescription: ${ce.description}` : ''}`
        ).join('\n\n');
        postContext += `\n\nCode Examples:\n${codeStr}`;
    }

    messages.push(new AIMessage('Current social post to edit:'));
    messages.push(new HumanMessage(postContext));

    // Add article content if available (for adding new information)
    if (options.postContent?.trim()) {
        messages.push(new AIMessage('Original article content (use this if user wants to add information from the source):'));
        messages.push(new HumanMessage(options.postContent));
    }

    // Add conversation context if available
    if (options.lastMessages.length > 0) {
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg.user_message));
            messages.push(new AIMessage(msg.ai_response));
        });
    }

    // Confirm context received
    messages.push(new AIMessage('I have the post and will apply ONLY the requested changes.'));

    // Current user message with edit request
    messages.push(new HumanMessage(options.message));

    return messages;
}
