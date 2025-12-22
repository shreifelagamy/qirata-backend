import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { CreateSettingsDto, UpdateSettingsDto } from '../dtos/settings.dto';
import { Settings } from '../entities/settings.entity';
import { HttpError } from '../middleware/error.middleware';

export class SettingsModel {
    private repository: Repository<Settings>;

    constructor() {
        this.repository = AppDataSource.getRepository(Settings);
    }

    async create(data: CreateSettingsDto): Promise<Settings> {
        const existing = await this.repository.findOne({
            where: { key: data.key, user_id: data.user_id }
        });

        if (existing) {
            throw new HttpError(400, `Setting with key "${data.key}" already exists for this user`);
        }

        const setting = this.repository.create(data);
        return await this.repository.save(setting);
    }

    async findByKey(key: string): Promise<Settings> {
        throw new HttpError(400, 'Use findByKeyAndUser method instead - settings require user_id');
    }

    async update(key: string, data: UpdateSettingsDto): Promise<Settings> {
        throw new HttpError(400, 'Use updateByUser method instead - settings require user_id');
    }

    async delete(key: string): Promise<void> {
        throw new HttpError(400, 'Use deleteByUser method instead - settings require user_id');
    }

    async deleteByUser(key: string, userId: string): Promise<void> {
        const result = await this.repository.delete({ key, user_id: userId });
        if (result.affected === 0) {
            throw new HttpError(404, `Setting with key "${key}" not found for this user`);
        }
    }

    async findByKeyAndUser(key: string, userId: string): Promise<Settings> {
        const setting = await this.repository.findOne({ 
            where: { key, user_id: userId } 
        });

        if (!setting) {
            throw new HttpError(404, `Setting with key "${key}" not found`);
        }

        return setting;
    }

    async updateByUser(key: string, data: UpdateSettingsDto, userId: string): Promise<Settings> {
        let setting = await this.repository.findOne({ 
            where: { key, user_id: userId } 
        });

        if (!setting) {
            // Create new setting if it doesn't exist
            setting = this.repository.create({ key, user_id: userId, ...data });
        } else {
            // Update existing setting
            Object.assign(setting, data);
        }

        return await this.repository.save(setting);
    }

    async findByUserId(userId: string): Promise<Settings[]> {
        return await this.repository.find({
            where: { user_id: userId },
            order: { key: 'ASC' }
        });
    }

    async findAll(): Promise<Settings[]> {
        return await this.repository.find({
            order: { key: 'ASC' }
        });
    }
}