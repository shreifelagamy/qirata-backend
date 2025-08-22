import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../app';
import { CreateLinkDto, UpdateLinkDto } from '../dtos/link.dto';
import { Link } from '../entities/link.entity';
import { HttpError } from '../middleware/error.middleware';

export class LinkModel {
    private repository: Repository<Link>;

    constructor() {
        this.repository = AppDataSource.getRepository(Link);
    }

    async create(data: CreateLinkDto): Promise<Link> {
        const link = this.repository.create(data);
        return await this.repository.save(link);
    }

    async findAll(): Promise<Link[]> {
        return await this.repository.find({
            order: { created_at: 'DESC' }
        });
    }

    async findById(id: string): Promise<Link> {
        if (!Link.isValidUUID(id)) {
            throw new HttpError(400, 'Invalid link ID format');
        }

        const link = await this.repository.findOne({ where: { id } });
        if (!link) {
            throw new HttpError(404, 'Link not found');
        }
        return link;
    }

    async findByUrl(url: string): Promise<Link | null> {
        return await this.repository.findOne({ where: { url } });
    }

    async findByRssUrl(rss_url: string): Promise<Link | null> {
        return await this.repository.findOne({ where: { rss_url } });
    }

    async update(id: string, data: UpdateLinkDto, entityManager?: EntityManager): Promise<Link> {
        const repository = entityManager?.getRepository(Link) || this.repository;
        const link = await this.findById(id);
        Object.assign(link, data);
        return await repository.save(link);
    }

    async findByUserId(userId: string): Promise<Link[]> {
        return await this.repository.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' }
        });
    }

    async findByIdAndUser(id: string, userId: string): Promise<Link> {
        if (!Link.isValidUUID(id)) {
            throw new HttpError(400, 'Invalid link ID format');
        }

        const link = await this.repository.findOne({ 
            where: { id, user_id: userId } 
        });
        if (!link) {
            throw new HttpError(404, 'Link not found');
        }
        return link;
    }

    async findByRssUrlAndUser(rss_url: string, userId: string): Promise<Link | null> {
        return await this.repository.findOne({ 
            where: { rss_url, user_id: userId } 
        });
    }

    async updateByUser(id: string, data: UpdateLinkDto, userId: string, entityManager?: EntityManager): Promise<Link> {
        const repository = entityManager?.getRepository(Link) || this.repository;
        const link = await this.findByIdAndUser(id, userId);
        Object.assign(link, data);
        return await repository.save(link);
    }

    async deleteByUser(id: string, userId: string): Promise<void> {
        if (!Link.isValidUUID(id)) {
            throw new HttpError(400, 'Invalid link ID format');
        }

        const result = await this.repository.delete({ id, user_id: userId });
        if (result.affected === 0) {
            throw new HttpError(404, 'Link not found');
        }
    }

    async delete(id: string): Promise<void> {
        if (!Link.isValidUUID(id)) {
            throw new HttpError(400, 'Invalid link ID format');
        }

        const result = await this.repository.delete(id);
        if (result.affected === 0) {
            throw new HttpError(404, 'Link not found');
        }
    }
}