import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createAgent, toolStrategy } from 'langchain';
import { createDebugCallback } from '../../../utils/debug-callback';
import { SocialPlatformList } from './social-platform.agent';

// Input schema for social post creation
const SocialPostCreateInput = z.object({
    message: z.string().describe('The current user message requesting social post creation'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    postContent: z.string().describe('Full content of the article/post to create social media content from'),
    platform: SocialPlatformList.describe('Target social media platform'),
    socialMediaContentPreferences: z.string().nullable().describe('User preferences for social media content style')
});

// Output schema for social post creation
export const SocialPostCreateOutput = z.object({
    message: z.string().describe('Response message to the user about the generated post'),
    structuredPost: z.object({
        postContent: z.string().describe('Main text content for the social media post'),
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
    }).describe('Structured social post content with code examples and visual elements')
});

const CACHED_SYSTEM_PROMPT = `You are Qirata's expert Social Media Content Creator.
Your goal is to craft high-engagement posts from the provided article content and context.

### RULES
- Always follow the platform-specific rules for Twitter and LinkedIn.
- Extract any code snippets from the article and place them in the 'codeExamples' section. Do not include code in the main post content.
- If a visual element (like a diagram) would enhance the post, describe it in the 'visualElements' section with clear instructions for creation.
- Use the conversation history to identify which specific points interested the user and highlight those in the post.
- Only create one post per request, even if multiple platforms are mentioned. Focus on the most recently requested platform.

### PLATFORM RULES (Apply Strict Adherence)
1. **Twitter:** - Style: Thread-style or punchy single tweet.
   - Constraints: <280 characters per tweet. 1-3 tags.
   - Tone: Concise, engaging, hashtag-friendly.
2. **LinkedIn:** - Style: Professional, spaced for readability.
   - Constraints: 1300-1600 characters. 3-5 tags.
   - Tone: Professional, thoughtful, industry insights.
   - **The Hook:** The first sentence MUST be a "scroll-stopper" (provocative question, surprising stat, or bold claim).

### CONTENT HANDLING
- **Text:** Place the main narrative in the 'postContent' field.
- **Code Extraction (CRITICAL):** If the article contains code, YOU MUST EXTRACT IT. Do not leave code in the body text. Move it to the 'codeExamples' array.
- **Visuals:** If a diagram would help, describe it in 'visualElements'.
`;

export default async function socialPostCreateAgent(options: z.infer<typeof SocialPostCreateInput>): Promise<z.infer<typeof SocialPostCreateOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-5.2',
        reasoning: {
            effort: "medium"
        },
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create agent
    const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(SocialPostCreateOutput)
    });

    const result = await agent.invoke({
        messages: buildMessagesArray(options)
    }, {
        callbacks: [
            createDebugCallback('social-post-create')
        ]
    });

    // Validate with Zod and return
    return result.structuredResponse;
}

function buildMessagesArray(options: z.infer<typeof SocialPostCreateInput>): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // 1. Static System Instructions
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    // 2. The Context Block (User Prefs + Article)
    let contextBlock = `Target Platform: ${options.platform.toUpperCase()}\n\n`;

    if (options.socialMediaContentPreferences?.trim()) {
        contextBlock += `User Content Preferences: "${options.socialMediaContentPreferences}"\n\n`;
    }

    contextBlock += `Article Content:\n${options.postContent}`;

    messages.push(new HumanMessage(contextBlock));

    // 3. Conversation History (Only if relevant)
    if (options.lastMessages.length > 0) {
        messages.push(new SystemMessage("Below is the recent Q&A history. Use this to identify which specific points interested the user."));
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(msg.user_message));
            messages.push(new AIMessage(msg.ai_response));
        });
    }

    // 4. Final Trigger
    messages.push(new HumanMessage(`Create the ${options.platform} post now. ${options.message}`));

    return messages;
}
