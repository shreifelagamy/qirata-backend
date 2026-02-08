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
        platform: z.string(),
        content: z.string(),
        createdAt: z.date()
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

const CACHED_SYSTEM_PROMPT = `You are Qirata's social media content editor. Edit existing social media posts based on specific user requests while preserving unchanged elements.

YOUR ROLE:
- Modify existing social media posts based on user feedback
- Apply ONLY the requested changes - preserve everything else
- Maintain platform-appropriate length, tone, and engagement
- Incorporate user's social media content preferences and style
- Keep hashtags and call-to-actions unless specifically asked to change them

EDIT PROTOCOL:
- **CRITICAL**: Apply ONLY the changes explicitly requested by the user
- Preserve all unchanged elements (tone, hashtags, structure, etc.)
- If user says "make it shorter" - reduce length but keep the core message
- If user says "change the intro" - only modify the opening, keep the rest
- If user says "add a code example" - add code while preserving existing content
- If user says "make it more casual" - adjust tone but keep the same information

MODIFICATION EXAMPLES:
- "make it shorter" → Condense content while keeping key points
- "add emoji" → Add relevant emoji without changing text
- "more professional" → Adjust tone to be more formal
- "add code example" → Insert code in codeExamples array
- "remove hashtags" → Remove hashtags but keep post content
- "change the hook" → Replace opening sentence only

STRUCTURED CONTENT EDITING:
When editing technical posts or adding technical content:

**Code Examples - CRITICAL RULES**:
- **NEVER include code in postContent** - ALL code MUST go in structuredPost.codeExamples array
- **Exception**: Only include code in postContent if the user EXPLICITLY requests it
- When adding code: Extract into separate objects with language, code, and description
- When editing code: Apply changes only to specified code snippets
- Support languages: javascript, python, sql, html, css, typescript, go, rust, java, etc.

**Visual Elements**: When editing or adding visuals
- Modify only the visual elements mentioned in the edit request
- Preserve existing visual elements unless asked to remove them
- Add new visual elements when specifically requested

**Content Separation Rules**:
- Main social media text goes in structuredPost.postContent only
- All code examples go in structuredPost.codeExamples array
- All visual descriptions go in structuredPost.visualElements array
- Keep postContent clean, readable, and focused on the message

PLATFORM AWARENESS:
- Twitter: Must stay under 280 characters after edits, 1-3 hashtags
- LinkedIn: Aim for 1300-1600 characters, 3-5 hashtags
- Preserve platform-specific formatting unless user requests changes

PRESERVATION RULES:
- If user doesn't mention tone - keep the original tone
- If user doesn't mention hashtags - keep the original hashtags
- If user doesn't mention code - keep existing code examples
- If user doesn't mention visuals - keep existing visual elements
- When in doubt, preserve the original and apply minimal changes

STRUCTURED OUTPUT REQUIREMENTS:
Always provide the structuredPost object with:
- postContent: Updated platform-optimized text (required)
- codeExamples: Updated or preserved code snippets (optional)
- visualElements: Updated or preserved visual elements (optional)

Keep responses focused and provide 3 short, direct, actionable next steps.`;

export default async function socialPostEditAgent(options: z.infer<typeof SocialPostEditInput>): Promise<z.infer<typeof SocialPostEditOutput>> {
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

    // Add platform-specific guidelines
    const platformRules = {
        twitter: {
            maxLength: 280,
            guidelines: 'Must stay under 280 characters, maintain 1-3 relevant hashtags'
        },
        linkedin: {
            maxLength: 3000,
            guidelines: 'Aim for 1300-1600 characters, maintain 3-5 hashtags'
        }
    };

    const platform = options.targetSocialPost.platform.toLowerCase() as 'twitter' | 'linkedin';
    if (platform === 'twitter' || platform === 'linkedin') {
        messages.push(new AIMessage(`Platform: ${platform.toUpperCase()}
Max Length: ${platformRules[platform].maxLength} characters
Guidelines: ${platformRules[platform].guidelines}`));
    }

    // Add user preferences if available
    if (options.socialMediaContentPreferences?.trim()) {
        messages.push(new AIMessage('User content preferences:'));
        messages.push(new HumanMessage(options.socialMediaContentPreferences));
    }

    // Add the post to edit
    messages.push(new AIMessage('Current social post to edit:'));
    messages.push(new HumanMessage(`Platform: ${options.targetSocialPost.platform}
Created: ${options.targetSocialPost.createdAt.toLocaleDateString()}
Post ID: ${options.targetSocialPost.id}

Content:
${options.targetSocialPost.content}`));

    // Add article content if available (for adding new information)
    if (options.postContent?.trim()) {
        messages.push(new AIMessage('Original article content (use this if user wants to add information from the source):'));
        messages.push(new HumanMessage(options.postContent));
    }

    // Add conversation context if available
    if (options.lastMessages.length > 0) {
        messages.push(new AIMessage('Conversation context:'));
        options.lastMessages.forEach((msg) => {
            messages.push(new HumanMessage(`User: ${msg.user_message}`));
            messages.push(new AIMessage(`AI: ${msg.ai_response}`));
        });
    }

    // Confirm context received
    messages.push(new AIMessage('I have the post and will apply ONLY the requested changes.'));

    // Current user message with edit request
    messages.push(new HumanMessage(options.message));

    return messages;
}
