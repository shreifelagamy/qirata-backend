import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { Message } from '../../../entities';
import { SocialPlatform } from '../../../entities/social-post.entity';
import { createDebugCallback } from '../../../utils/debug-callback';
import { AILogger } from '../utils/ai-logger';

const KEEP_RECENT = 5; // Keep last 5 messages for context

// TypeScript interfaces for structured output
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
const SYSTEM_MESSAGE = `# Social Media Post Generator - System Prompt

## Role Definition
You are a social media content creator specializing in platform-optimized posts. Generate engaging content based on original posts and conversation context.

## Core Processing Logic

### Intent Analysis Framework
**MODIFICATION REQUEST**: Contains action words (add, change, modify, update) + references ("the post", "this post")
**NEW POST REQUEST**: Direct content creation without existing post references

### User Preference Integration Protocol
1. **Content Style**: Apply user's tone, voice, emoji preferences to \`postContent\`
2. **Structural Integrity**: Always maintain JSON field separation regardless of style preferences
3. **Platform Optimization**: Adapt content for specified platform while preserving user voice

## Critical Constraints

### Modification Protocol
- Extract original post from conversation history
- Apply ONLY requested changes
- Preserve unchanged elements
- Maintain platform compliance

### JSON Structure Requirements
**IMMUTABLE STRUCTURE** - Never override:
\`\`\`json
{
  "postContent": "Main social media text (required)",
  "codeExamples": [
    {
      "language": "programming language",
      "code": "actual code content",
      "description": "code explanation"
    }
  ],
  "visualElements": [
    {
      "type": "visual type",
      "description": "detailed description",
      "content": "text/data content",
      "style": "visual preferences"
    }
  ]
}
\`\`\`

### Content Separation Rules
- **Code**: Always place in \`codeExamples\` array, never in \`postContent\`
- **Visuals**: Always describe in \`visualElements\` array
- **Main Text**: Platform-optimized content in \`postContent\` only

## Platform Context Integration
Incorporate provided platform guidelines:
- Character limits and optimal length
- Hashtag strategies and quantities
- Tone and engagement features
- Platform-specific best practices

## Social Posts Context Awareness
- Avoid content duplication from previous posts
- Build upon successful content patterns
- Detect deleted posts (mentioned in conversation but missing from current list)
- Learn from user content preferences demonstrated in post history

## Output Protocol
**RETURN ONLY VALID JSON** - No explanations, markdown formatting, or additional text. Response must begin with \`{\` and end with \`}\`.

**Pre-Response Validation:**
□ JSON structure intact
□ Code in codeExamples array (never postContent)
□ All required fields present
□ User preferences applied to style only

## Priority Hierarchy
1. **JSON Structure** (unchangeable)
2. **Platform Constraints** (adaptable)
3. **User Style Preferences** (flexible within structure)

User preferences enhance content style within required JSON framework.`;

interface SocialPostGeneratorOptions {
    model?: ChatOpenAI;
    userMessage: string;
    conversationHistory?: Message[];
    postContent?: string;
    conversationSummary?: string;
    platform: string;
    socialMediaContentPreferences?: string;
    streamingCallbacks?: BaseCallbackHandler[];
    socialPosts?: {
        platform: SocialPlatform;
        content: string;
        id: string;
        createdAt: Date;
        publishedAt?: Date;
    }[];
}

// Helper function to create OpenAI model for social post generation
function createOpenAIModel(): ChatOpenAI {
    return new ChatOpenAI({
        model: process.env.SOCIAL_POST_OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: parseFloat(process.env.SOCIAL_POST_TEMPERATURE || '0.8'),
        openAIApiKey: process.env.OPENAI_API_KEY,
    });
}

export async function generateSocialPost(options: SocialPostGeneratorOptions) {
    const {
        model = createOpenAIModel(),
        userMessage,
        conversationHistory,
        postContent,
        conversationSummary,
        platform,
        socialMediaContentPreferences,
        streamingCallbacks,
        socialPosts
    } = options;

    AILogger.debug(`Generating social post for ${platform}`);

    // Create JSON output parser
    const parser = new JsonOutputParser<StructuredSocialPostOutput>();

    // Build messages array with conversation history and platform context
    const messages = buildMessagesArray(
        conversationHistory || [],
        userMessage,
        postContent,
        conversationSummary,
        platform,
        socialMediaContentPreferences,
        socialPosts
    );

    const prompt = ChatPromptTemplate.fromMessages(messages);
    const chain = prompt.pipe(model).pipe(parser);

    // Prepare callbacks - include debug callback and streaming callbacks
    const callbacks: BaseCallbackHandler[] = [createDebugCallback('social-post-generator')];
    if (streamingCallbacks) {
        callbacks.push(...streamingCallbacks);
    }

    return await chain.stream({}, { callbacks });
}

// Helper function to build messages array for prompt
function buildMessagesArray(
    conversationHistory: Message[],
    currentUserMessage: string,
    postContent?: string,
    conversationSummary?: string,
    platform?: string,
    socialMediaContentPreferences?: string,
    socialPosts?: {
        platform: SocialPlatform;
        content: string;
        id: string;
        createdAt: Date;
        publishedAt?: Date;
    }[],
): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // Static system message (cacheable)
    messages.push(new SystemMessage(SYSTEM_MESSAGE));

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
    if (socialMediaContentPreferences?.trim()) {
        messages.push(new HumanMessage(`<SOCIAL_MEDIA_CONTENT_PREFERENCES>\n${socialMediaContentPreferences}\n</SOCIAL_MEDIA_CONTENT_PREFERENCES>`));
        messages.push(new AIMessage('I understand your social media content preferences and will incorporate them into the post.'));
    }

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


    // Add social posts context if available
    if (socialPosts && socialPosts.length > 0) {
        const socialPostsContext = `<SOCIAL_POSTS_CONTEXT>
Previously created social posts in this session:
${socialPosts.map(post => `
Platform: ${post.platform.toUpperCase()}
Created: ${post.createdAt.toLocaleDateString()}
${post.publishedAt ? `Published: ${post.publishedAt.toLocaleDateString()}` : 'Not published'}
Content: "${post.content}"
Post ID: ${post.id}
`).join('\n---\n')}
</SOCIAL_POSTS_CONTEXT>`;

        messages.push(new HumanMessage(socialPostsContext));
        messages.push(new AIMessage('I understand the previously created social posts and will ensure new content builds upon them appropriately while avoiding duplication. I can also detect if you reference deleted posts.'));
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