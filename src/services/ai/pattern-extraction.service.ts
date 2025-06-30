import { Repository } from 'typeorm';
import { AppDataSource } from '../../app';
import { Settings } from '../../entities/settings.entity';
import { logger } from '../../utils/logger';

export interface UserPattern {
  type: 'vocabulary' | 'request' | 'platform' | 'style';
  pattern: string;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  context?: string;
}

export interface PatternAnalysis {
  userId: string;
  patterns: UserPattern[];
  commonRequests: string[];
  vocabularyPreferences: string[];
  platformBehaviors: Record<string, string[]>;
  updatedAt: Date;
}

export interface MessageContext {
  userMessage: string;
  aiResponse: string;
  sessionId: string;
  platform?: string;
  timestamp: Date;
}

export class PatternExtractionService {
  private readonly settingsRepository: Repository<Settings>;

  // Common request patterns to track
  private readonly requestPatterns = [
    { pattern: /make.*(shorter|brief|concise|brief)/i, type: 'length_shorter' },
    { pattern: /make.*(longer|detailed|elaborate|expand)/i, type: 'length_longer' },
    { pattern: /add.*(emojis?|emoji)/i, type: 'add_emojis' },
    { pattern: /remove.*(emojis?|emoji)/i, type: 'remove_emojis' },
    { pattern: /more.*(professional|formal)/i, type: 'tone_professional' },
    { pattern: /more.*(casual|informal|friendly)/i, type: 'tone_casual' },
    { pattern: /add.*(hashtags?|#)/i, type: 'add_hashtags' },
    { pattern: /remove.*(hashtags?|#)/i, type: 'remove_hashtags' },
    { pattern: /rewrite.*(twitter|tweet)/i, type: 'platform_twitter' },
    { pattern: /rewrite.*(linkedin)/i, type: 'platform_linkedin' },
    { pattern: /add.*(data|statistics|numbers)/i, type: 'add_data' },
    { pattern: /more.*(engaging|catchy|attention)/i, type: 'more_engaging' },
    { pattern: /simplify|simpler|easy to understand/i, type: 'simplify' },
    { pattern: /add.*(call to action|cta)/i, type: 'add_cta' }
  ];

  // Vocabulary preference patterns
  private readonly vocabularyPatterns = [
    { pattern: /\b(awesome|amazing|incredible|fantastic)\b/i, category: 'enthusiasm_high' },
    { pattern: /\b(good|nice|decent|okay)\b/i, category: 'enthusiasm_moderate' },
    { pattern: /\b(leverage|utilize|implement|execute)\b/i, category: 'business_formal' },
    { pattern: /\b(use|do|make|get)\b/i, category: 'language_simple' },
    { pattern: /\b(ROI|KPI|metrics|analytics|data)\b/i, category: 'business_technical' },
    { pattern: /\b(game-changer|disruptive|innovative|cutting-edge)\b/i, category: 'buzzwords' }
  ];

  // Platform-specific behavior patterns
  private readonly platformPatterns = [
    { pattern: /twitter|tweet/i, platform: 'twitter' },
    { pattern: /linkedin|professional network/i, platform: 'linkedin' },
    { pattern: /instagram|insta|ig/i, platform: 'instagram' },
    { pattern: /facebook|fb/i, platform: 'facebook' }
  ];

  constructor() {
    this.settingsRepository = AppDataSource.getRepository(Settings);
  }

  /**
   * Analyze a message and extract patterns
   */
  async analyzeMessage(userId: string, context: MessageContext): Promise<void> {
    try {
      const extractedPatterns = this.extractPatternsFromMessage(context);

      if (extractedPatterns.length > 0) {
        await this.updateUserPatterns(userId, extractedPatterns);
        logger.debug(`Extracted ${extractedPatterns.length} patterns for user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error analyzing message patterns for user ${userId}:`, error);
    }
  }

  /**
   * Extract patterns from a single message
   */
  private extractPatternsFromMessage(context: MessageContext): UserPattern[] {
    const patterns: UserPattern[] = [];
    const message = context.userMessage.toLowerCase();
    const timestamp = context.timestamp;

    // Extract request patterns
    for (const requestPattern of this.requestPatterns) {
      if (requestPattern.pattern.test(message)) {
        patterns.push({
          type: 'request',
          pattern: requestPattern.type,
          frequency: 1,
          firstSeen: timestamp,
          lastSeen: timestamp,
          context: context.userMessage.substring(0, 100) // First 100 chars for context
        });
      }
    }

    // Extract vocabulary patterns
    for (const vocabPattern of this.vocabularyPatterns) {
      if (vocabPattern.pattern.test(message)) {
        patterns.push({
          type: 'vocabulary',
          pattern: vocabPattern.category,
          frequency: 1,
          firstSeen: timestamp,
          lastSeen: timestamp,
          context: context.userMessage.substring(0, 100)
        });
      }
    }

    // Extract platform patterns
    for (const platformPattern of this.platformPatterns) {
      if (platformPattern.pattern.test(message)) {
        patterns.push({
          type: 'platform',
          pattern: platformPattern.platform,
          frequency: 1,
          firstSeen: timestamp,
          lastSeen: timestamp,
          context: context.userMessage.substring(0, 100)
        });
      }
    }

    // Extract style patterns from AI response feedback
    if (context.aiResponse) {
      const stylePatterns = this.extractStylePatterns(context.userMessage, context.aiResponse);
      patterns.push(...stylePatterns.map(pattern => ({
        ...pattern,
        firstSeen: timestamp,
        lastSeen: timestamp
      })));
    }

    return patterns;
  }

  /**
   * Extract style patterns from user feedback on AI responses
   */
  private extractStylePatterns(userMessage: string, aiResponse: string): Omit<UserPattern, 'firstSeen' | 'lastSeen'>[] {
    const patterns: Omit<UserPattern, 'firstSeen' | 'lastSeen'>[] = [];
    const message = userMessage.toLowerCase();

    // Detect feedback patterns
    if (/(too long|lengthy|verbose)/.test(message)) {
      patterns.push({
        type: 'style',
        pattern: 'prefers_shorter',
        frequency: 1,
        context: userMessage.substring(0, 100)
      });
    }

    if (/(too short|brief|need more)/.test(message)) {
      patterns.push({
        type: 'style',
        pattern: 'prefers_longer',
        frequency: 1,
        context: userMessage.substring(0, 100)
      });
    }

    if (/(too formal|stiff|robotic)/.test(message)) {
      patterns.push({
        type: 'style',
        pattern: 'prefers_casual',
        frequency: 1,
        context: userMessage.substring(0, 100)
      });
    }

    if (/(too casual|informal|need professional)/.test(message)) {
      patterns.push({
        type: 'style',
        pattern: 'prefers_formal',
        frequency: 1,
        context: userMessage.substring(0, 100)
      });
    }

    return patterns;
  }

  /**
   * Update user patterns in storage
   */
  private async updateUserPatterns(userId: string, newPatterns: UserPattern[]): Promise<void> {
    try {
      const currentAnalysis = await this.getUserPatterns(userId);
      const updatedPatterns = this.mergePatterns(currentAnalysis.patterns, newPatterns);

      const updatedAnalysis: PatternAnalysis = {
        userId,
        patterns: updatedPatterns,
        commonRequests: this.extractCommonRequests(updatedPatterns),
        vocabularyPreferences: this.extractVocabularyPreferences(updatedPatterns),
        platformBehaviors: this.extractPlatformBehaviors(updatedPatterns),
        updatedAt: new Date()
      };

      await this.saveUserPatterns(userId, updatedAnalysis);
    } catch (error) {
      logger.error(`Error updating user patterns for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Merge new patterns with existing ones
   */
  private mergePatterns(existing: UserPattern[], newPatterns: UserPattern[]): UserPattern[] {
    const patternMap = new Map<string, UserPattern>();

    // Add existing patterns
    for (const pattern of existing) {
      const key = `${pattern.type}:${pattern.pattern}`;
      patternMap.set(key, pattern);
    }

    // Merge or add new patterns
    for (const newPattern of newPatterns) {
      const key = `${newPattern.type}:${newPattern.pattern}`;
      const existingPattern = patternMap.get(key);

      if (existingPattern) {
        existingPattern.frequency += 1;
        existingPattern.lastSeen = newPattern.lastSeen;
        if (newPattern.context) {
          existingPattern.context = newPattern.context; // Update with latest context
        }
      } else {
        patternMap.set(key, newPattern);
      }
    }

    return Array.from(patternMap.values());
  }

  /**
   * Get user patterns from storage
   */
  async getUserPatterns(userId: string): Promise<PatternAnalysis> {
    try {
      const setting = await this.settingsRepository.findOne({
        where: { key: `user_patterns_${userId}` }
      });

      if (!setting || !setting.value) {
        return {
          userId,
          patterns: [],
          commonRequests: [],
          vocabularyPreferences: [],
          platformBehaviors: {},
          updatedAt: new Date()
        };
      }

      return JSON.parse(setting.value) as PatternAnalysis;
    } catch (error) {
      logger.error(`Error getting user patterns for ${userId}:`, error);
      return {
        userId,
        patterns: [],
        commonRequests: [],
        vocabularyPreferences: [],
        platformBehaviors: {},
        updatedAt: new Date()
      };
    }
  }

  /**
   * Save user patterns to storage
   */
  private async saveUserPatterns(userId: string, analysis: PatternAnalysis): Promise<void> {
    try {
      const key = `user_patterns_${userId}`;
      const value = JSON.stringify(analysis);

      let setting = await this.settingsRepository.findOne({ where: { key } });

      if (setting) {
        setting.value = value;
        setting.updated_at = new Date();
      } else {
        // setting = this.settingsRepository.create({
        //   key,
        //   value,
        //   type: 'json'
        // });
      }

    //   await this.settingsRepository.save(setting);
      logger.debug(`Saved pattern analysis for user ${userId}`);
    } catch (error) {
      logger.error(`Error saving user patterns for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Extract common requests from patterns
   */
  private extractCommonRequests(patterns: UserPattern[]): string[] {
    return patterns
      .filter(p => p.type === 'request')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(p => p.pattern);
  }

  /**
   * Extract vocabulary preferences from patterns
   */
  private extractVocabularyPreferences(patterns: UserPattern[]): string[] {
    return patterns
      .filter(p => p.type === 'vocabulary')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(p => p.pattern);
  }

  /**
   * Extract platform behaviors from patterns
   */
  private extractPlatformBehaviors(patterns: UserPattern[]): Record<string, string[]> {
    const behaviors: Record<string, string[]> = {};

    for (const pattern of patterns) {
      if (pattern.type === 'platform') {
        if (!behaviors[pattern.pattern]) {
          behaviors[pattern.pattern] = [];
        }
        if (pattern.context && !behaviors[pattern.pattern].includes(pattern.context)) {
          behaviors[pattern.pattern].push(pattern.context);
        }
      }
    }

    return behaviors;
  }

  /**
   * Get pattern insights for AI context
   */
  async getPatternInsights(userId: string): Promise<string> {
    const analysis = await this.getUserPatterns(userId);

    if (analysis.patterns.length === 0) {
      return 'No user patterns detected yet.';
    }

    const insights: string[] = [];

    if (analysis.commonRequests.length > 0) {
      insights.push(`Common requests: ${analysis.commonRequests.slice(0, 3).join(', ')}`);
    }

    if (analysis.vocabularyPreferences.length > 0) {
      insights.push(`Vocabulary style: ${analysis.vocabularyPreferences.slice(0, 3).join(', ')}`);
    }

    const platformCount = Object.keys(analysis.platformBehaviors).length;
    if (platformCount > 0) {
      insights.push(`Active on ${platformCount} platform(s): ${Object.keys(analysis.platformBehaviors).join(', ')}`);
    }

    return insights.join('. ') + '.';
  }

  /**
   * Clear user patterns
   */
  async clearUserPatterns(userId: string): Promise<void> {
    try {
      await this.settingsRepository.delete({ key: `user_patterns_${userId}` });
      logger.info(`Cleared patterns for user ${userId}`);
    } catch (error) {
      logger.error(`Error clearing patterns for user ${userId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const patternExtractionService = new PatternExtractionService();