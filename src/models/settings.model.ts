import { Repository } from 'typeorm';
import { AppDataSource } from '../app';
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
            where: { key: data.key }
        });

        if (existing) {
            throw new HttpError(400, `Setting with key "${data.key}" already exists`);
        }

        const setting = this.repository.create(data);
        return await this.repository.save(setting);
    }

    async findByKey(key: string): Promise<Settings> {
        const setting = await this.repository.findOne({ where: { key } });

        if (!setting) {
            throw new HttpError(404, `Setting with key "${key}" not found`);
        }

        return setting;
    }

    async update(key: string, data: UpdateSettingsDto): Promise<Settings> {
        let setting = await this.repository.findOne({ where: { key } });

        if (!setting) {
            // Create new setting if it doesn't exist
            setting = this.repository.create({ key, ...data });
        } else {
            // Update existing setting
            Object.assign(setting, data);
        }

        return await this.repository.save(setting);
    }

    async delete(key: string): Promise<void> {
        const result = await this.repository.delete({ key });
        if (result.affected === 0) {
            throw new HttpError(404, `Setting with key "${key}" not found`);
        }
    }

    async findAll(): Promise<Settings[]> {
        return await this.repository.find({
            order: { key: 'ASC' }
        });
    }
}