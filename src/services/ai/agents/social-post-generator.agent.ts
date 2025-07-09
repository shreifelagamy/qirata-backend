import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { Message } from '../../../entities';
import { SocialPlatform } from '../../../entities/social-post.entity';
import { DEFAULT_MODEL_CONFIGS, createModelFromConfig } from '../../../types/model-config.types';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

const KEEP_RECENT = 5; // Keep last 5 messages for context

export interface PlatformConfig {
    maxLength: number;
    tone: string;
    hashtagsRecommended: boolean;
    specialFeatures: string[];
    guidelines: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
    [SocialPlatform.TWITTER]: {
        maxLength: 280,
        tone: 'concise and engaging',
        hashtagsRecommended: true,
        specialFeatures: ['hashtags', 'threads', 'quick engagement'],
        guidelines: `- Keep under 280 characters
- Use 1-3 relevant hashtags
- Write a compelling hook in the first line
- Make it shareable and engaging
- Include call-to-action if appropriate`
    },
    [SocialPlatform.LINKEDIN]: {
        maxLength: 3000,
        tone: 'professional and thoughtful',
        hashtagsRecommended: true,
        specialFeatures: ['professional networking', 'industry insights', 'thought leadership'],
        guidelines: `- Professional tone with industry insights
- Use up to 3000 characters, aim for 1300-1600 for best engagement
- Start with a compelling hook or question
- Include 3-5 relevant hashtags
- Add value to professional networks
- End with a question to encourage engagement`
    },
    [SocialPlatform.FACEBOOK]: {
        maxLength: 2000,
        tone: 'engaging and community-focused',
        hashtagsRecommended: false,
        specialFeatures: ['community engagement', 'storytelling', 'longer form content'],
        guidelines: `- Focus on community engagement and storytelling
- Use conversational tone
- Encourage comments and shares
- Keep hashtags minimal (Facebook doesn't prioritize them)
- Include emotional elements and personal touch
- Aim for 1-3 paragraphs for best engagement`
    },
    [SocialPlatform.INSTAGRAM]: {
        maxLength: 2200,
        tone: 'visual and hashtag-optimized',
        hashtagsRecommended: true,
        specialFeatures: ['visual storytelling', 'hashtag optimization', 'authentic voice'],
        guidelines: `- Visual storytelling approach
- Use up to 2200 characters
- Include 5-10 relevant hashtags for discoverability
- Write in personal, authentic voice
- Consider the visual context
- Use line breaks for readability
- Include emojis where appropriate`
    }
};

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an expert social media content creator. Your role is to create engaging, platform-optimized social media posts based on original content and conversation context.

## Core Responsibilities:
- Create platform-specific social media content
- Analyze conversation context for modification vs new post requests
- Apply user-requested changes to existing posts
- Optimize content for platform-specific best practices

## Content Analysis Protocol:

### Step 1: Intent Detection
Determine if this is a:
- **MODIFICATION REQUEST**: User wants to change an existing post
- **NEW POST REQUEST**: User wants to create original content

### Modification Intent Indicators:
- **Action words**: add, remove, change, modify, update, include, make it, rewrite
- **Reference patterns**: "the post", "this post", "my post"
- **Specific changes**: "add hashtags", "make shorter", "change tone"

### Step 2: Modification Protocol
When modifying existing posts:
1. **Extract original post** from conversation history
2. **Preserve unchanged content** - only modify what's requested
3. **Apply specific changes** exactly as requested
4. **Maintain post integrity** and platform compliance
5. **Keep user's voice** unless specifically asked to change

### Step 3: Platform Optimization
- Respect character limits and platform guidelines
- Use appropriate tone and style for the platform
- Include platform-specific features (hashtags, mentions, etc.)
- Optimize for engagement and platform algorithms

## Critical Rules:
- **Modification requests override platform best practices**
- **Always start with existing post for modifications**
- **Only change what was specifically requested**
- **Never create new content when user wants modifications**
- **Provide clear, actionable content ready for posting**

## OUTPUT FORMAT:
- Return ONLY the social media post content
- Do NOT include any explanations, introductions, or additional context
- Do NOT use phrases like "Here's your post:", "Post:", or any other prefixes
- The output should be ready to copy and paste directly to the social platform`;

interface SocialPostGeneratorOptions {
    model?: ChatOllama;
    userMessage: string;
    conversationHistory?: Message[];
    postContent?: string;
    conversationSummary?: string;
    platform: string;
    userPreferences?: string;
    streamingCallbacks?: BaseCallbackHandler[];
}

export async function generateSocialPost(options: SocialPostGeneratorOptions): Promise<string> {
    const {
        model = createModelFromConfig(DEFAULT_MODEL_CONFIGS.socialPostGenerator),
        userMessage,
        conversationHistory,
        postContent,
        conversationSummary,
        platform,
        userPreferences,
        streamingCallbacks
    } = options;

    try {
        logger.info(`Generating social post for ${platform}`);

        // Build messages array with conversation history and platform context
        const messages = buildMessagesArray(
            conversationHistory || [],
            userMessage,
            postContent,
            conversationSummary,
            platform,
            userPreferences
        );

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        // Prepare callbacks - include debug callback and streaming callbacks
        const callbacks: BaseCallbackHandler[] = [createDebugCallback('social-post-generator')];
        if (streamingCallbacks) {
            callbacks.push(...streamingCallbacks);
        }

        const response = await chain.invoke({}, {
            callbacks
        });

        logger.info(`Social post generated successfully for ${platform}`);
        return response;

    } catch (error) {
        logger.error('[SocialPostGenerator] Social post generation failed:', error);
        return 'I apologize, but I encountered an error while generating your social media post. Please try again.';
    }
}

// Helper function to build messages array for prompt
function buildMessagesArray(
    conversationHistory: Message[],
    currentUserMessage: string,
    postContent?: string,
    conversationSummary?: string,
    platform?: string,
    userPreferences?: string
): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // Static system message (cacheable)
    messages.push(new SystemMessage(SYSTEM_MESSAGE));

    // Add original post content as context if available
    if (postContent?.trim()) {
        messages.push(new HumanMessage(`<ORIGINAL_POST>\n${postContent}\n</ORIGINAL_POST>`));
        messages.push(new AIMessage('I have the original post content and will use it as the foundation for creating your social media post.'));
    }

    // Add conversation summary if available
    if (conversationSummary?.trim()) {
        messages.push(new HumanMessage(`<CONVERSATION_SUMMARY>\n${conversationSummary}\n</CONVERSATION_SUMMARY>`));
        messages.push(new AIMessage('I understand the conversation context and will incorporate relevant insights.'));
    }

    // Add platform-specific context
    if (platform) {
        const config = PLATFORM_CONFIGS[platform];
        const platformContext = `<PLATFORM_CONTEXT>
Platform: ${platform.toUpperCase()}
Character Limit: ${config.maxLength}
Tone: ${config.tone}
Hashtags: ${config.hashtagsRecommended ? 'Recommended' : 'Minimal use'}
Features: ${config.specialFeatures.join(', ')}

Guidelines:
${config.guidelines}
</PLATFORM_CONTEXT>`;

        messages.push(new HumanMessage(platformContext));
        messages.push(new AIMessage(`I'll create content optimized for ${platform} following its specific guidelines and best practices.`));
    }

    // Add user preferences if available
    if (userPreferences?.trim()) {
        messages.push(new HumanMessage(`<USER_PREFERENCES>\n${userPreferences}\n</USER_PREFERENCES>`));
        messages.push(new AIMessage('I understand your style preferences and will incorporate them into the post.'));
    }

    // Add recent conversation history as separate messages
    const recentMessages = conversationHistory.slice(-KEEP_RECENT);

    for (const msg of recentMessages) {
        if (msg.user_message?.trim()) {
            messages.push(new HumanMessage(msg.user_message));
        }
        if (msg.ai_response?.trim()) {
            messages.push(new AIMessage(msg.ai_response));
        }
    }

    // Current user message
    messages.push(new HumanMessage(currentUserMessage));

    return messages;
}