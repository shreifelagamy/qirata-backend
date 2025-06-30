import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { SocialPlatform } from '../../entities/social-post.entity';
import { logger } from '../../utils/logger';

export interface PlatformDetectionResult {
    platform?: SocialPlatform;
    needsClarification: boolean;
    confidence: number;
    reasoning?: string;
}

export interface PlatformDetectionContext {
    userMessage: string;
    conversationHistory?: any[];
    previousMessages?: any[];
}

// Zod schema for platform detection response
const PlatformDetectionSchema = z.object({
    platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram']).nullable(),
    confidence: z.number().min(0).max(1),
    needsClarification: z.boolean(),
    reasoning: z.string()
});

type PlatformDetectionResponse = z.infer<typeof PlatformDetectionSchema>;

export class PlatformDetectionService {
    private chatModel: ChatOllama;
    private parser: StructuredOutputParser<any>;

    constructor(chatModel: ChatOllama) {
        this.chatModel = chatModel;
        this.parser = StructuredOutputParser.fromZodSchema(PlatformDetectionSchema);
    }

    /**
     * AI-powered platform detection that considers context and supports multiple languages
     */
    async detectPlatform(context: PlatformDetectionContext): Promise<PlatformDetectionResult> {
        try {
            const prompt = this.buildPlatformDetectionPrompt();
            const chain = prompt.pipe(this.chatModel).pipe(this.parser);

            const chatHistory = this.formatChatHistory(context.conversationHistory || context.previousMessages || []);

            const response = await chain.invoke({
                userMessage: context.userMessage,
                chatHistory: chatHistory,
                format_instructions: this.parser.getFormatInstructions()
            });

            // Validate the response matches our schema
            const validatedResponse = PlatformDetectionSchema.parse(response);
            return this.convertToDetectionResult(validatedResponse);
        } catch (error) {
            logger.error('[PlatformDetection] AI detection failed:', error);
            // Fallback to keyword-based detection if AI fails
            return this.fallbackKeywordDetection(context.userMessage);
        }
    }

    /**
     * Build the AI prompt for platform detection
     */
    private buildPlatformDetectionPrompt(): ChatPromptTemplate {
        return ChatPromptTemplate.fromMessages([
            ['system', `You are an expert social media platform detection assistant. Your task is to determine which social media platform the user wants to create content for based on their message and conversation history.

## Available Platforms:
- **twitter**: Short-form content, tweets, microblogging (280 characters)
- **linkedin**: Professional networking, business content, career-focused
- **facebook**: Community engagement, personal and business posts, longer content
- **instagram**: Visual content, photos, stories, reels, lifestyle content

## Detection Guidelines:

### Direct Platform Mentions:
Look for explicit mentions of platforms in any language:
- English: "twitter", "tweet", "x", "linkedin", "facebook", "fb", "instagram", "insta", "ig"
- Arabic: "تويتر", "تغريدة", "لينكد إن", "فيسبوك", "انستغرام", "انستا"
- Platform URLs: "x.com", "linkedin.com", "facebook.com", "instagram.com"

## Detection Strategy:
**IMPORTANT**: Only detect a platform if there is an EXPLICIT mention of it. Do NOT infer or guess platforms from content characteristics, tone, or context clues.

### What Counts as Explicit Platform Mention:
- **Direct platform names**: "twitter", "linkedin", "facebook", "instagram"
- **Arabic platform names**: "تويتر", "لينكد إن", "فيسبوك", "انستغرام"
- **Common abbreviations**: "fb" (facebook), "ig"/"insta" (instagram)
- **Platform-specific actions**: "tweet this", "post on linkedin", etc.
- **URLs**: mentions of platform URLs or domains

### What Does NOT Count:
- Content type preferences (visual, professional, etc.)
- Hashtag mentions without platform context
- General social media terms without specific platform
- Tone or style characteristics
- Assumptions based on content format

## Response Guidelines:

### Confidence Levels:
- **0.9-1.0**: Explicit platform mention with clear intent
- **0.5-0.8**: Platform mentioned but with some ambiguity
- **0.0**: No explicit platform mention found

### Clarification Rule:
- Set needsClarification to true and confidence to 0 if NO explicit platform is mentioned
- Set needsClarification to false only if platform is explicitly mentioned
- Set platform to null when no platform is detected

### Multi-language Support:
- Detect platform mentions in Arabic, English, and other languages
- Only count explicit platform names, not inferred preferences

**CRITICAL**: Be conservative. If there's any doubt about which platform the user wants, return needsClarification true with confidence 0. The system has a dedicated clarification step to ask users to choose their preferred platform.

{format_instructions}`],
            ['human', `Current user message: {userMessage}

Previous conversation context:
{chatHistory}

Please analyze this message and conversation history to detect which social media platform the user wants to create content for.`]
        ]);
    }

    /**
     * Format chat history for the prompt
     */
    private formatChatHistory(history: any[]): string {
        if (!history || history.length === 0) {
            return 'No previous conversation history available.';
        }

        return history
            .slice(-10) // Get last 10 messages for context
            .map((msg, index) => {
                const role = msg.role || (index % 2 === 0 ? 'user' : 'assistant');
                const content = msg.content || msg.message || msg.text || '';
                return `${role}: ${content}`;
            })
            .join('\n');
    }

    /**
     * Convert structured parser response to detection result
     */
    private convertToDetectionResult(response: PlatformDetectionResponse): PlatformDetectionResult {
        const platform = this.validatePlatform(response.platform);

        logger.info('[PlatformDetection] AI detection result:', {
            platform,
            confidence: response.confidence,
            needsClarification: response.needsClarification,
            reasoning: response.reasoning
        });

        return {
            platform,
            confidence: response.confidence,
            needsClarification: response.needsClarification,
            reasoning: response.reasoning
        };
    }

    /**
     * Validate platform string and convert to enum
     */
    private validatePlatform(platformStr: string | null): SocialPlatform | undefined {
        if (!platformStr || platformStr === 'null') {
            return undefined;
        }

        const normalizedPlatform = platformStr.toLowerCase();
        const platformMap: Record<string, SocialPlatform> = {
            'twitter': SocialPlatform.TWITTER,
            'linkedin': SocialPlatform.LINKEDIN,
            'facebook': SocialPlatform.FACEBOOK,
            'instagram': SocialPlatform.INSTAGRAM
        };

        return platformMap[normalizedPlatform];
    }

    /**
     * Fallback keyword-based detection for when AI fails - Conservative approach
     */
    private fallbackKeywordDetection(userMessage: string): PlatformDetectionResult {
        const message = userMessage.toLowerCase();

        // Only explicit platform keywords - removed vague terms like 'professional', 'visual'
        const platformKeywords = {
            [SocialPlatform.TWITTER]: ['twitter', 'tweet', 'x.com', 'x post', 'تويتر', 'تغريدة'],
            [SocialPlatform.LINKEDIN]: ['linkedin', 'لينكد إن'],
            [SocialPlatform.FACEBOOK]: ['facebook', 'fb', 'facebook post', 'فيسبوك'],
            [SocialPlatform.INSTAGRAM]: ['instagram', 'insta', 'ig', 'انستغرام', 'انستا']
        };

        let detectedPlatform: SocialPlatform | undefined = undefined;
        let maxConfidence = 0;

        for (const [platform, keywords] of Object.entries(platformKeywords)) {
            for (const keyword of keywords) {
                if (message.includes(keyword)) {
                    const confidence = keyword.length > 2 ? 0.8 : 0.6;
                    if (confidence > maxConfidence) {
                        maxConfidence = confidence;
                        detectedPlatform = platform as SocialPlatform;
                    }
                }
            }
        }

        // Conservative approach: if no explicit platform found, always need clarification
        const needsClarification = !detectedPlatform;
        const finalConfidence = detectedPlatform ? maxConfidence : 0;

        logger.info('[PlatformDetection] Fallback keyword detection:', {
            detectedPlatform,
            confidence: finalConfidence,
            needsClarification
        });

        return {
            platform: detectedPlatform,
            confidence: finalConfidence,
            needsClarification,
            reasoning: needsClarification
                ? 'No explicit platform mention found - clarification needed'
                : 'Fallback keyword-based detection used'
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

**متاح أيضاً باللغة العربية:**
يمكنك اختيار المنصة المناسبة لك من الخيارات أعلاه

Just let me know which platform you prefer, and I'll create the perfect post for that audience!`;
    }

    /**
     * Check if user message is responding to platform clarification
     */
    isRespondingToPlatformQuestion(userMessage: string, conversationHistory?: any[]): boolean {
        const message = userMessage.toLowerCase();

        // Check if recent conversation mentioned platform selection
        const recentClarification = conversationHistory?.some(msg =>
            msg.content?.includes('Which platform would you like') ||
            msg.content?.includes('Available platforms') ||
            msg.content?.includes('متاح أيضاً باللغة العربية')
        );

        // Only check for explicit platform names when responding to clarification
        const platformNames = [
            'twitter', 'linkedin', 'facebook', 'instagram',
            'تويتر', 'لينكد إن', 'فيسبوك', 'انستغرام',
            'fb', 'ig', 'insta'
        ];

        const containsPlatformName = platformNames.some(platform => message.includes(platform));

        // Only consider it a platform response if there was recent clarification AND explicit platform mentioned
        return Boolean(recentClarification) && containsPlatformName;
    }
}