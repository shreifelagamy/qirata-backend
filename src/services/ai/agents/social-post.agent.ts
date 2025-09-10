import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

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

// Output schema for social post generation
export const SocialPostOutput = z.object({
    socialPostContent: z.string().describe('The generated social media post content'),
    message: z.string().describe('Response message to the user about the generated post'),
    suggestedOptions: z.array(z.string()).max(3).describe('Up to 3 suggested actions for the user'),
    socialPostId: z.string().nullable().describe('ID of the social post being edited (only for edit operations)')
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

Keep responses focused and provide actionable next steps for the user.`;

export async function socialPostAgent(options: z.infer<typeof SocialPostInput>): Promise<z.infer<typeof SocialPostOutput>> {
    const model = new ChatOpenAI({
        model: 'gpt-4.1-mini',
        temperature: 0.7,
        maxTokens: 500,
        openAIApiKey: process.env.OPENAI_API_KEY
    }).withStructuredOutput(SocialPostOutput);

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

    const result = await model.invoke(messages);
    return result;
}