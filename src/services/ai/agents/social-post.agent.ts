import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

// Input schema for social post generation
const SocialPostInput = z.object({
    message: z.string().describe('The current user message requesting social post creation'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(5).describe('Previous conversation messages with both user and AI responses'),
    postSummary: z.string().optional().describe('Summary of the current post for context'),
    platform: z.enum(['twitter', 'linkedin']).describe('The target social media platform'),
    socialMediaContentPreferences: z.string().optional().describe('User preferences for social media content style')
});

// Output schema for social post generation
export const SocialPostOutput = z.object({
    socialPostContent: z.string().describe('The generated social media post content'),
    message: z.string().describe('Response message to the user about the generated post'),
    suggestedOptions: z.array(z.string()).max(3).describe('Up to 3 suggested actions for the user')
});

// System prompt for social post generation
const SYSTEM_PROMPT = `You are Qirata's social media content creator. Generate engaging platform-optimized posts based on post summaries and conversation context.

YOUR ROLE:
- Create compelling social media content for Twitter or LinkedIn
- Leverage conversation context to highlight points the user found interesting
- Follow platform-specific guidelines for length, tone, and engagement
- Incorporate user's social media content preferences and style
- Include relevant hashtags and call-to-actions when appropriate

CONTENT STRATEGY:
- Use the post summary as the foundation for content
- Incorporate discussion points from conversation history (both user questions and AI explanations)
- Apply user's content preferences to match their desired style
- Make it engaging and shareable for the target platform
- Add value to the user's professional or personal brand

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

    const platformContext = `<PLATFORM_CONTEXT>
Platform: ${options.platform.toUpperCase()}
Max Length: ${platformRules[options.platform].maxLength} characters
Tone: ${platformRules[options.platform].tone}
Guidelines: ${platformRules[options.platform].guidelines}
</PLATFORM_CONTEXT>`;

    messages.push(new HumanMessage(platformContext));

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

Create an engaging ${options.platform} post that incorporates the provided context and follows platform best practices.`));

    const result = await model.invoke(messages);
    return result;
}