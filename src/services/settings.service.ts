import { SettingsModel } from '../models/settings.model';
import { CreateSettingsDto, UpdateSettingsDto } from '../dtos/settings.dto';
import { Settings } from '../entities/settings.entity';
import { HttpError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export class SettingsService {
  private settingsModel: SettingsModel;

  constructor() {
    this.settingsModel = new SettingsModel();
  }

  async getSetting(key: string): Promise<Settings> {
    try {
      return await this.settingsModel.findByKey(key);
    } catch (error) {
      logger.error(`Error getting setting ${key}:`, error);
      throw new HttpError(500, 'Failed to get setting');
    }
  }

  async updateSetting(key: string, data: UpdateSettingsDto): Promise<Settings> {
    try {
      return await this.settingsModel.update(key, data);
    } catch (error) {
      logger.error(`Error updating setting ${key}:`, error);
      throw new HttpError(500, 'Failed to update setting');
    }
  }

  async createSetting(data: CreateSettingsDto): Promise<Settings> {
    try {
      return await this.settingsModel.create(data);
    } catch (error) {
      logger.error('Error creating setting:', error);
      throw new HttpError(500, 'Failed to create setting');
    }
  }
}