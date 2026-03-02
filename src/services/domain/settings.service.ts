import { Settings } from '../../entities/settings.entity';
import { HttpError } from '../../middleware/error.middleware';
import { SettingsModel } from '../../models/settings.model';
import { logger } from '../../utils/logger';

export class SettingsService {
    private settingsModel: SettingsModel;

    constructor() {
        this.settingsModel = new SettingsModel();
    }

    async show(key: string, userId: string): Promise<Settings> {
        try {
            return await this.settingsModel.findByKeyAndUser(key, userId);
        } catch (error) {
            logger.error(`Error getting setting ${key}:`, error);
            throw new HttpError(500, 'Failed to get setting');
        }
    }

    async update(key: string, value: string, userId: string, description?: string): Promise<Settings> {
        try {
            return await this.settingsModel.updateByUser(key, { value, description }, userId);
        } catch (error) {
            logger.error(`Error updating setting ${key}:`, error);
            throw new HttpError(500, 'Failed to update setting');
        }
    }

    async list(userId: string): Promise<Settings[]> {
        try {
            return await this.settingsModel.findByUserId(userId);
        } catch (error) {
            logger.error('Error getting all settings:', error);
            throw new HttpError(500, 'Failed to get all settings');
        }
    }

    async upsert(key: string, value: string, userId: string, description?: string): Promise<Settings> {
        try {
            return await this.settingsModel.updateByUser(key, { value, description }, userId);
        } catch (error) {
            logger.error(`Error upserting setting ${key}:`, error);
            throw new HttpError(500, 'Failed to upsert setting');
        }
    }

    async create(key: string, value: string, userId: string, description?: string): Promise<Settings> {
        try {
            return await this.settingsModel.create({ key, value, user_id: userId, description });
        } catch (error) {
            logger.error('Error creating setting:', error);
            throw new HttpError(500, 'Failed to create setting');
        }
    }

    async getSocialMediaContentPreferences(userId: string): Promise<string> {
        try {
            const setting = await this.settingsModel.findByKeyAndUser('social_media_content_preferences', userId);
            return setting.value || '';
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                return ''; // Return empty string if no preferences set yet
            }
            logger.error('Error getting social media content preferences:', error);
            throw new HttpError(500, 'Failed to get social media content preferences');
        }
    }

    async setSocialMediaContentPreferences(preferences: string, userId: string): Promise<Settings> {
        try {
            return await this.settingsModel.updateByUser('social_media_content_preferences', {
                value: preferences,
                description: 'User preferences for social media content generation'
            }, userId);
        } catch (error) {
            logger.error('Error setting social media content preferences:', error);
            throw new HttpError(500, 'Failed to set social media content preferences');
        }
    }

    async getPostQAReplyPreferences(userId: string): Promise<string> {
        try {
            const setting = await this.settingsModel.findByKeyAndUser('post_qa_reply_preferences', userId);
            return setting?.value || '';
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                return '';
            }
            logger.error('Error getting post QA reply preferences:', error);
            throw new HttpError(500, 'Failed to get post QA reply preferences');
        }
    }

    async setPostQAReplyPreferences(preferences: string, userId: string): Promise<Settings> {
        try {
            const sanitized = preferences.trim().slice(0, 500);
            return await this.settingsModel.updateByUser('post_qa_reply_preferences', {
                value: sanitized,
                description: 'User preferences for post Q&A reply style'
            }, userId);
        } catch (error) {
            logger.error('Error setting post QA reply preferences:', error);
            throw new HttpError(500, 'Failed to set post QA reply preferences');
        }
    }
}