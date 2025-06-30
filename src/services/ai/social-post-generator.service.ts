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

export interface PlatformDetectionResult {
    platform?: SocialPlatform;
    needsClarification: boolean;
    confidence: number;
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

    private platformKeywords = {
        [SocialPlatform.TWITTER]: ['twitter', 'tweet', 'x.com', 'x post'],
        [SocialPlatform.LINKEDIN]: ['linkedin', 'professional', 'business network'],
        [SocialPlatform.FACEBOOK]: ['facebook', 'fb', 'facebook post'],
        [SocialPlatform.INSTAGRAM]: ['instagram', 'insta', 'ig', 'visual']
    };

    /**
     * Detects platform from user message with confidence scoring
     */
    detectPlatform(userMessage: string): PlatformDetectionResult {
        const message = userMessage.toLowerCase();
        let detectedPlatform: SocialPlatform | undefined = undefined;
        let maxConfidence = 0;

        // Check for explicit platform mentions
        for (const [platform, keywords] of Object.entries(this.platformKeywords)) {
            for (const keyword of keywords) {
                if (message.includes(keyword)) {
                    const confidence = keyword.length > 2 ? 0.9 : 0.7; // Longer keywords = higher confidence
                    if (confidence > maxConfidence) {
                        maxConfidence = confidence;
                        detectedPlatform = platform as SocialPlatform;
                    }
                }
            }
        }

        const needsClarification = !detectedPlatform || maxConfidence < 0.8;

        logger.info('Platform detection result', {
            userMessage,
            detectedPlatform,
            confidence: maxConfidence,
            needsClarification
        });

        return {
            platform: detectedPlatform,
            needsClarification,
            confidence: maxConfidence
        };
    }

    /**
     * Generate platform clarification message
     */
    generatePlatformClarificationMessage(): string {
        return `I'd be happy to create a social post for you! Which platform would you like this optimized for?

**Available platforms:**
🐦 **Twitter** - Short & punchy (280 characters, hashtags)
💼 **LinkedIn** - Professional & thoughtful (longer format, industry focus)
👥 **Facebook** - Community-focused & engaging (storytelling approach)
📸 **Instagram** - Visual & hashtag-rich (authentic voice, visual context)

Just let me know which platform you prefer, and I'll create the perfect post for that audience!`;
    }

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

Make sure the post captures the essence of the original content while being perfectly optimized for ${platform}'s audience and format.`],
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

    /**
     * Check if user message is responding to platform clarification
     */
    isRespondingToPlatformQuestion(userMessage: string, conversationHistory?: any[]): boolean {
        const message = userMessage.toLowerCase();

        // Check if user is selecting a platform after clarification
        const platformMentions = Object.values(this.platformKeywords).flat();
        const containsPlatform = platformMentions.some(keyword => message.includes(keyword));

        // Check if recent conversation mentioned platform selection
        const recentClarification = conversationHistory?.some(msg =>
            msg.content?.includes('Which platform would you like') ||
            msg.content?.includes('Available platforms')
        );

        return containsPlatform && (recentClarification || message.includes('platform'));
    }

    /**
     * Enhanced platform detection that considers conversation context
     */
    detectPlatformWithContext(userMessage: string, conversationHistory?: any[]): PlatformDetectionResult {
        // First try normal detection
        const result = this.detectPlatform(userMessage);

        // If platform was detected with high confidence, return it
        if (result.platform && result.confidence >= 0.8) {
            return result;
        }

        // Check if this is a response to platform clarification
        if (this.isRespondingToPlatformQuestion(userMessage, conversationHistory)) {
            // User is choosing a platform after being asked
            const platformResult = this.detectPlatform(userMessage);
            if (platformResult.platform) {
                return {
                    platform: platformResult.platform,
                    needsClarification: false,
                    confidence: 0.9 // High confidence since user is responding to our question
                };
            }
        }

        return result;
    }
}

// Export singleton instance
export const socialPostGeneratorService = new SocialPostGeneratorService();