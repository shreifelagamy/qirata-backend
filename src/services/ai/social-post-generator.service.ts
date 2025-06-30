import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SocialPlatform } from '../../entities/social-post.entity';
import { AIContext } from '../../types/ai.types';
import { logger } from '../../utils/logger';

export interface PlatformConfig {
    maxLength: number;
    tone: string;
    hashtagsRecommended: boolean;
    specialFeatures: string[];
    guidelines: string;
}


export class SocialPostGeneratorService {
    private platformConfigs: Record<SocialPlatform, PlatformConfig> = {
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


    /**
     * Build enhanced social post prompt template
     */
    buildSocialPostPromptTemplate(platform: SocialPlatform): ChatPromptTemplate {
        const config = this.platformConfigs[platform];

        return ChatPromptTemplate.fromMessages([
            ['system', `You are an expert social media content creator specializing in ${platform.toUpperCase()} posts.

## Original Post Content:
{postContent}

## Previous Conversation Summary:
{conversationSummary}

## User Preferences & Style:
{userPreferences}

## Platform: ${platform.toUpperCase()}
${this.getPlatformInstructions(platform)}

## Your Task:
Create an engaging ${platform} post based on the original content. The user is currently discussing this content and wants to share it on ${platform}.

**Key Requirements:**
- Maximum ${config.maxLength} characters
- ${config.tone} tone
- ${config.hashtagsRecommended ? 'Include relevant hashtags' : 'Minimal hashtags'}
- Optimize for ${config.specialFeatures.join(', ')}

**Content Guidelines:**
${config.guidelines}

**CRITICAL: User Requirements Analysis**
Before creating the post, carefully analyze the user's message for ANY specific requirements, preferences, or instructions they may have included. Look for:

- **Specific hashtags** they want included (e.g., #hashtag)
- **Mentions** they want added (e.g., @username)
- **Tone adjustments** (e.g., "make it more professional", "keep it casual", "make it funny")
- **Content modifications** (e.g., "add more details about X", "focus on Y", "don't mention Z")
- **Specific phrases or quotes** they want included
- **Length preferences** (e.g., "keep it short", "make it longer")
- **Call-to-action requests** (e.g., "ask a question", "include a CTA")
- **Emoji preferences** (e.g., "add emojis", "no emojis")
- **Links or URLs** they want preserved or added
- **Any other specific instructions** about format, style, or content

**IMPORTANT**: These user-specified requirements take absolute priority over the general platform guidelines. If there's any conflict between platform best practices and what the user specifically requested, follow the user's requirements.

Make sure the post captures the essence of the original content while being perfectly optimized for ${platform}'s audience and format, and most importantly, incorporates ALL specific requirements mentioned in the user's message.`],
            ['human', '{userMessage}']
        ]);
    }

    /**
     * Build platform clarification prompt template
     */
    buildPlatformClarificationPromptTemplate(): ChatPromptTemplate {
        // Dynamically build the platform options from the SocialPlatform enum
        const availablePlatforms = Object.values(SocialPlatform)
            .map(platform => {
                const config = this.platformConfigs[platform];
                const platformIcons = {
                    [SocialPlatform.TWITTER]: '🐦',
                    [SocialPlatform.LINKEDIN]: '💼',
                    [SocialPlatform.FACEBOOK]: '👥',
                    [SocialPlatform.INSTAGRAM]: '📸'
                };

                return `${platformIcons[platform]} **${platform.charAt(0).toUpperCase() + platform.slice(1)}** - ${config.tone} (${config.maxLength} characters${config.hashtagsRecommended ? ', hashtags recommended' : ', minimal hashtags'})`;
            })
            .join('\n');

        const platformList = Object.values(SocialPlatform).map(p => p.toLowerCase()).join(', ');

        return ChatPromptTemplate.fromMessages([
            ['system', `You are an AI assistant helping users create social media posts. The user wants to create a social post but hasn't specified which platform.

## Original Post Content:
{postContent}

## Previous Conversation Summary:
{conversationSummary}

## Available Social Media Platforms:
The following platforms are supported in our system:
${availablePlatforms}

Your task is to ask the user to clarify which social media platform they want to create content for from the available options: ${platformList}.

Be helpful and explain the differences between these specific platforms to help them choose. Only suggest platforms that are available in our SocialPlatform enum.

Respond with a clear message asking them to choose from the available platform options.`],
            ['human', '{userMessage}']
        ]);
    }

    /**
     * Get platform-specific instructions
     */
    private getPlatformInstructions(platform: SocialPlatform): string {
        const config = this.platformConfigs[platform];
        return `
**Character Limit:** ${config.maxLength}
**Recommended Tone:** ${config.tone}
**Hashtags:** ${config.hashtagsRecommended ? 'Recommended' : 'Minimal use'}
**Platform Features:** ${config.specialFeatures.join(', ')}`;
    }

    /**
     * Build user preferences context
     */
    buildUserPreferencesContext(context?: AIContext): string {
        if (!context?.userPreferences) {
            return 'No specific user preferences. Use engaging, authentic tone appropriate for the platform.';
        }

        const prefs = context.userPreferences;
        const details: string[] = [];

        if (prefs.voice) {
            const voiceDescriptions: Record<string, string> = {
                professional: 'Professional, authoritative language',
                friendly: 'Warm, approachable tone',
                direct: 'Straightforward and concise',
                storyteller: 'Narrative elements and engaging storytelling'
            };
            details.push(`Voice: ${voiceDescriptions[prefs.voice] || prefs.voice}`);
        }

        if (prefs.contentStyle) {
            const styleDescriptions: Record<string, string> = {
                'data-driven': 'Focus on facts, statistics, and evidence',
                'practical': 'Actionable insights and practical advice',
                'thought-provoking': 'Challenge thinking and spark discussion'
            };
            details.push(`Content Style: ${styleDescriptions[prefs.contentStyle] || prefs.contentStyle}`);
        }

        if (prefs.hookPreference) {
            const hookDescriptions: Record<string, string> = {
                'questions': 'Start with engaging questions',
                'observations': 'Begin with interesting insights',
                'bold-claims': 'Open with attention-grabbing statements'
            };
            details.push(`Hook Style: ${hookDescriptions[prefs.hookPreference] || prefs.hookPreference}`);
        }

        return details.length > 0 ? details.join('\n') : 'Standard preferences - engaging and authentic';
    }

}

// Export singleton instance
export const socialPostGeneratorService = new SocialPostGeneratorService();