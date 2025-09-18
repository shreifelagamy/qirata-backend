import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createDebugCallback } from '../../../utils/debug-callback';

// Input schema for social post generation and editing
const SocialPostInput = z.object({
    message: z.string().describe('The current user message requesting social post creation or editing'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(5).describe('Previous conversation messages with both user and AI responses'),
    postSummary: z.string().nullable().describe('Summary of the current post for context'),
    platform: z.enum(['twitter', 'linkedin']).nullable().describe('The target social media platform (optional for edits, will be inferred from existing posts)'),
    socialMediaContentPreferences: z.string().nullable().describe('User preferences for social media content style'),
    socialPosts: z.array(z.object({
        platform: z.string(),
        content: z.string(),
        id: z.string(),
        createdAt: z.date(),
        publishedAt: z.date().nullable()
    })).nullable().describe('Previously created social posts for reference and editing')
});

// TypeScript interfaces for structured output (matching old generator)
export interface CodeExample {
    language: string; // Programming language (e.g., javascript, python, sql)
    code: string; // The actual code content
    description?: string; // Optional explanation of the code
}

export interface VisualElement {
    type: string; // Type of visual (diagram, chart, infographic, screenshot)
    description: string; // Detailed description of the visual to create
    content: string; // Text content or data for the visual
    style: string; // Visual style preferences
}

export interface StructuredSocialPostOutput {
    postContent: string; // Main text content for the social media post
    codeExamples?: CodeExample[]; // Optional array of code snippets
    visualElements?: VisualElement[]; // Optional array of visual elements to create
}

// Output schema for social post generation (for agent return)
export const SocialPostOutput = z.object({
    message: z.string().describe('Response message to the user about the generated post'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct actions relevant to the social post context'),
    socialPostId: z.string().nullable().describe('ID of the social post being edited (only for edit operations)'),
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

// System prompt for social post generation and editing
const SYSTEM_PROMPT = `You are Qirata's social media content creator. Generate engaging platform-optimized posts and edit existing posts based on user requests.

YOUR ROLE:
- Create compelling social media content for Twitter or LinkedIn
- Edit and modify existing social posts based on specific user requests
- Leverage conversation context to highlight points the user found interesting
- Follow platform-specific guidelines for length, tone, and engagement
- Incorporate user's social media content preferences and style
- Include relevant hashtags and call-to-actions when appropriate

CONTENT STRATEGY:
- For NEW posts: Use the post summary as the foundation for content
- For EDITS: Identify the target post and apply only the requested changes
- Incorporate discussion points from conversation history (both user questions and AI explanations)
- Apply user's content preferences to match their desired style
- Make it engaging and shareable for the target platform
- Add value to the user's professional or personal brand

STRUCTURED CONTENT CREATION:
When the conversation includes technical topics, programming concepts, or educational content:

**Code Examples**: Always place code in the structuredPost.codeExamples array, never in the main postContent
- Identify programming languages, code snippets, or technical examples from the conversation
- Extract code into separate objects with language, code, and description fields
- Support languages: javascript, python, sql, html, css, typescript, etc.

**Visual Elements**: When content would benefit from visual representation
- Identify opportunities for diagrams, charts, infographics, or screenshots
- Create detailed descriptions for visual elements that enhance understanding
- Include content and style preferences for visual creation

**Content Separation Rules**:
- Main social media text goes in structuredPost.postContent only
- All code examples go in structuredPost.codeExamples array
- All visual descriptions go in structuredPost.visualElements array
- Never include code blocks or visual descriptions in the main postContent

EDIT DETECTION & HANDLING:
- EDIT REQUEST: Contains action words (edit, change, modify, update, fix) + references to existing posts
- POST IDENTIFICATION: Use context clues to identify which post to edit:
  - Platform references: "the LinkedIn post", "Twitter post"
  - Content references: "the post about AI", "marketing post"
  - Position references: "the last post", "first post", "recent post"
  - Implicit references: "change it", "make it shorter" (refers to most recent post)
- MODIFICATION PROTOCOL: Extract original post content and apply ONLY requested changes
- PRESERVE UNCHANGED: Keep all elements that weren't specifically requested to change
- RETURN POST ID: When editing, ALWAYS return the socialPostId of the post being modified

SOCIAL POSTS CONTEXT AWARENESS:
- Reference previously created posts to avoid duplication
- Build upon successful content patterns
- Learn from user content preferences demonstrated in post history
- Detect when user references posts that may have been deleted

PLATFORM OPTIMIZATION:
- Twitter: Concise, engaging, hashtag-friendly, under 280 chars
- LinkedIn: Professional, thoughtful, industry insights, longer form

STRUCTURED OUTPUT REQUIREMENTS:
Always provide the structuredPost object with:
- postContent: Platform-optimized main text (required)
- codeExamples: Array of code snippets if technical content is present (optional)
- visualElements: Array of visual element descriptions if applicable (optional)

Keep responses focused and provide 3 short, direct, actionable next steps relevant to the social post context.`;

export async function socialPostAgent(options: z.infer<typeof SocialPostInput>): Promise<z.infer<typeof SocialPostOutput>> {
    // Create tool from Zod schema
    const socialPostTool = {
        name: "socialPostResponse",
        description: "Generate or edit social media post content with code examples and structured elements",
        schema: zodToJsonSchema(SocialPostOutput)
    };

    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.7,
        maxTokens: 1000,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).bindTools([socialPostTool]);

    // Build messages array with XML tags
    const messages = [new SystemMessage(SYSTEM_PROMPT)];

    // Add platform context
    const platformRules = {
        twitter: {
            maxLength: 280,
            tone: 'concise and engaging',
            guidelines: 'Keep under 280 characters, use 1-3 relevant hashtags, write a compelling hook'
        },
        linkedin: {
            maxLength: 3000,
            tone: 'professional and thoughtful',
            guidelines: 'Professional tone, aim for 1300-1600 characters, start with compelling hook, use 3-5 hashtags'
        }
    };

    if (options.platform) {
        // Specific platform provided - use only that platform's rules
        const platformContext = `<PLATFORM_CONTEXT>
Platform: ${options.platform.toUpperCase()}
Max Length: ${platformRules[options.platform].maxLength} characters
Tone: ${platformRules[options.platform].tone}
Guidelines: ${platformRules[options.platform].guidelines}
</PLATFORM_CONTEXT>`;

        messages.push(new HumanMessage(platformContext));
    } else {
        // No platform specified (likely edit request) - include all platform specifications
        const allPlatformsContext = `<ALL_PLATFORMS_CONTEXT>
For edit requests, determine the target platform from existing posts and apply the appropriate rules:

TWITTER:
- Max Length: ${platformRules.twitter.maxLength} characters
- Tone: ${platformRules.twitter.tone}
- Guidelines: ${platformRules.twitter.guidelines}

LINKEDIN:
- Max Length: ${platformRules.linkedin.maxLength} characters
- Tone: ${platformRules.linkedin.tone}
- Guidelines: ${platformRules.linkedin.guidelines}

Use the platform of the post being edited or infer from context clues in the user's message.
</ALL_PLATFORMS_CONTEXT>`;

        messages.push(new HumanMessage(allPlatformsContext));
    }

    // Add user preferences if available
    if (options.socialMediaContentPreferences?.trim()) {
        messages.push(new HumanMessage(`<SOCIAL_MEDIA_CONTENT_PREFERENCES>
${options.socialMediaContentPreferences}
</SOCIAL_MEDIA_CONTENT_PREFERENCES>`));
    }

    // Add post summary if available
    if (options.postSummary?.trim()) {
        messages.push(new HumanMessage(`<POST_SUMMARY>
${options.postSummary}
</POST_SUMMARY>`));
    }

    // Add social posts context if available
    if (options.socialPosts && options.socialPosts.length > 0) {
        const socialPostsContext = `<SOCIAL_POSTS_CONTEXT>
Previously created social posts in this session:
${options.socialPosts.map(post => `
Platform: ${post.platform.toUpperCase()}
Created: ${post.createdAt.toLocaleDateString()}
${post.publishedAt ? `Published: ${post.publishedAt.toLocaleDateString()}` : 'Not published'}
Content: "${post.content}"
Post ID: ${post.id}
`).join('\n---\n')}
</SOCIAL_POSTS_CONTEXT>`;

        messages.push(new HumanMessage(socialPostsContext));
    }

    // Add conversation context if available
    if (options.lastMessages.length > 0) {
        const conversationText = options.lastMessages
            .map(msg => `User: ${msg.user_message}\nAI: ${msg.ai_response}`)
            .join('\n---\n');

        messages.push(new HumanMessage(`<CONVERSATION_CONTEXT>
${conversationText}

Use this conversation to understand what topics the user found interesting and what points should be highlighted in the social post.
</CONVERSATION_CONTEXT>`));
    }

    // Current user message
    messages.push(new HumanMessage(`Current request: "${options.message}"

${options.socialPosts && options.socialPosts.length > 0
    ? 'If this is an edit request, identify the target post from the SOCIAL_POSTS_CONTEXT above and MUST return the socialPostId of the post being edited. Apply only the requested changes. If this is a new post request, create engaging content that avoids duplicating existing posts and do NOT return a socialPostId.'
    : 'Create an engaging'} ${options.platform} post that incorporates the provided context and follows platform best practices.`));

    const result = await model.invoke(messages, {
        callbacks: [
            createDebugCallback('social-post')
        ]
    });

    // Extract tool call result
    const toolCall = result.tool_calls?.[0];
    if (!toolCall) {
        throw new Error('No tool call found in response');
    }

    // Validate with Zod and return
    return SocialPostOutput.parse(toolCall.args);
}