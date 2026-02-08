import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { createDebugCallback } from '../../../utils/debug-callback';
import { createAgent, toolStrategy } from 'langchain';

// Input schema for social post creation
const SocialPostCreateInput = z.object({
    message: z.string().describe('The current user message requesting social post creation'),
    lastMessages: z.array(z.object({
        user_message: z.string(),
        ai_response: z.string()
    })).max(10).describe('Previous conversation messages for context'),
    postContent: z.string().describe('Full content of the article/post to create social media content from'),
    platform: z.enum(['twitter', 'linkedin']).describe('Target social media platform'),
    socialMediaContentPreferences: z.string().nullable().describe('User preferences for social media content style')
});

// Output schema for social post creation
export const SocialPostCreateOutput = z.object({
    message: z.string().describe('Response message to the user about the generated post'),
    suggestedOptions: z.array(z.string()).max(3).describe('3 short, direct actions relevant to the social post'),
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

const CACHED_SYSTEM_PROMPT = `You are Qirata's social media content creator. Generate engaging, platform-optimized posts based on article content and user preferences.

YOUR ROLE:
- Create compelling social media content for Twitter or LinkedIn
- Transform article content into shareable, engaging posts
- Leverage conversation context to highlight points the user found interesting
- Follow platform-specific guidelines for length, tone, and engagement
- Incorporate user's social media content preferences and style
- Include relevant hashtags and call-to-actions when appropriate

CONTENT STRATEGY:
- Use the article content as the foundation for the post
- Incorporate discussion points from conversation history (both user questions and AI explanations)
- Apply user's content preferences to match their desired style
- Make it engaging and shareable for the target platform
- Add value to the user's professional or personal brand

STRUCTURED CONTENT CREATION:
When the content includes technical topics, programming concepts, or educational content:

**Code Examples - CRITICAL RULES**:
- **ALWAYS generate code examples for technical posts** - code makes technical content more valuable and shareable
- **NEVER include code in postContent** - ALL code MUST go in structuredPost.codeExamples array
- **Exception**: Only include code in postContent if the user EXPLICITLY requests it (e.g., "include the code in the post", "put the code snippet in the text")
- Identify programming languages, code snippets, or technical examples from the article or conversation
- Extract code into separate objects with language, code, and description fields
- Support languages: javascript, python, sql, html, css, typescript, go, rust, java, etc.
- Provide helpful descriptions that explain what the code does and why it's useful

**Visual Elements**: When content would benefit from visual representation
- Identify opportunities for diagrams, charts, infographics, or screenshots
- Create detailed descriptions for visual elements that enhance understanding
- Include content and style preferences for visual creation

**Content Separation Rules**:
- Main social media text goes in structuredPost.postContent only
- All code examples go in structuredPost.codeExamples array (UNLESS user explicitly requested inline code)
- All visual descriptions go in structuredPost.visualElements array
- Keep postContent clean, readable, and focused on the message
- Technical posts should ALWAYS have codeExamples populated with relevant code snippets

PLATFORM OPTIMIZATION:
- Twitter: Concise, engaging, hashtag-friendly, under 280 characters, use 1-3 relevant hashtags
- LinkedIn: Professional, thoughtful, industry insights, 1300-1600 characters, use 3-5 hashtags

STRUCTURED OUTPUT REQUIREMENTS:
Always provide the structuredPost object with:
- postContent: Platform-optimized main text (required)
- codeExamples: Array of code snippets if technical content is present (optional)
- visualElements: Array of visual element descriptions if applicable (optional)

Keep responses focused and provide 3 short, direct, actionable next steps relevant to the social post context.`;

export default async function socialPostCreateAgent(options: z.infer<typeof SocialPostCreateInput>): Promise<z.infer<typeof SocialPostCreateOutput>> {
    // Initialize model
    const model = new ChatOpenAI({
        model: 'gpt-5.2',
        temperature: 0.7,
        maxTokens: 1000,
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
    messages.push(new SystemMessage(CACHED_SYSTEM_PROMPT));

    // Add platform-specific guidelines
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

    messages.push(new AIMessage(`Platform: ${options.platform.toUpperCase()}
Max Length: ${platformRules[options.platform].maxLength} characters
Tone: ${platformRules[options.platform].tone}
Guidelines: ${platformRules[options.platform].guidelines}`));

    // Add user preferences if available
    if (options.socialMediaContentPreferences?.trim()) {
        messages.push(new AIMessage('User content preferences:'));
        messages.push(new HumanMessage(options.socialMediaContentPreferences));
    }

    // Add article content
    messages.push(new AIMessage('Article content to create social post from:'));
    messages.push(new HumanMessage(options.postContent));

    // Add conversation context if available
    if (options.lastMessages.length > 0) {
        messages.push(new AIMessage('Conversation context - use this to understand what topics the user found interesting:'));
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(`User: ${msg.user_message}`));
            messages.push(new AIMessage(`AI: ${msg.ai_response}`));
        });
    }

    // Confirm context received
    messages.push(new AIMessage('I have all the context and will create an engaging social post.'));

    // Current user message
    messages.push(new HumanMessage(options.message));

    return messages;
}
