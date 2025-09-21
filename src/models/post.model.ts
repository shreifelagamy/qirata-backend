import { EntityManager, Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { CreatePostDto, UpdatePostDto } from '../dtos/post.dto';
import { PostExpanded } from '../entities/post-expanded.entity';
import { Post } from '../entities/post.entity';
import { HttpError } from '../middleware/error.middleware';

interface PostFilters {
    read?: boolean;
    link_id?: string;
    search?: string;
    source?: string;
    limit?: number;
    offset?: number;
    external_links?: string[];
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export class PostModel {
    private repository: Repository<Post>;
    private expandedRepository: Repository<PostExpanded>;

    constructor() {
        this.repository = AppDataSource.getRepository(Post);
        this.expandedRepository = AppDataSource.getRepository(PostExpanded);
    }

    async create(data: CreatePostDto, entityManager?: EntityManager): Promise<Post> {
        const repository = entityManager?.getRepository(Post) || this.repository;
        const post = repository.create(data);
        return await repository.save(post);
    }

    async findAll(filters: PostFilters): Promise<[Post[], number]> {
        console.log(filters.read !== undefined)
        const query = this.repository.createQueryBuilder('post')
            .orderBy('post.sequence_id', 'DESC');

        if (filters.external_links?.length) {
            query.andWhere('post.external_link IN (:...links)', { links: filters.external_links });
        }

        if (filters.read !== undefined) {
            query.andWhere('post.read_at IS ' + (filters.read ? 'NOT NULL' : 'NULL'));
        }

        if (filters.link_id) {
            query.andWhere('post.link_id = :linkId', { linkId: filters.link_id });
        }

        if (filters.search) {
            query.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)',
                { search: `%${filters.search}%` });
        }

        if (filters.source) {
            query.andWhere('post.source ILIKE :source', { source: `%${filters.source}%` });
        }

        if (filters.limit) {
            query.take(filters.limit);
        }

        if (filters.offset) {
            query.skip(filters.offset);
        }
        return await query.getManyAndCount();
    }

    async findById(id: string): Promise<Post> {
        const post = await this.repository.findOne({
            where: { id }
        });

        if (!post) {
            throw new HttpError(404, 'Post not found');
        }

        return post;
    }

    async update(id: string, data: UpdatePostDto, entityManager?: EntityManager): Promise<Post> {
        const repository = entityManager?.getRepository(Post) || this.repository;
        const post = await this.findById(id);
        Object.assign(post, data);
        return await repository.save(post);
    }

    async markAsRead(id: string): Promise<Post> {
        const post = await this.findById(id);
        post.read_at = new Date();
        return await this.repository.save(post);
    }

    async delete(id: string): Promise<void> {
        const post = await this.findById(id);
        await this.repository.remove(post);
    }

    async findExpandedById(id: string): Promise<PostExpanded> {
        const expanded = await this.expandedRepository.findOne({
            where: { post_id: id }
        });

        if (!expanded) {
            throw new HttpError(404, 'Expanded post data not found');
        }

        return expanded;
    }

    async createExpanded(postId: string, data: Partial<PostExpanded>): Promise<PostExpanded> {
        const expanded = this.expandedRepository.create({
            post_id: postId,
            ...data
        });
        return await this.expandedRepository.save(expanded);
    }

    async findAllByUser(filters: PostFilters, userId: string): Promise<[Post[], number]> {
        const query = this.repository.createQueryBuilder('post')
            .select([
                'post.id',
                'post.user_id',
                'post.sequence_id',
                'post.title',
                'post.image_url',
                'post.external_link',
                'post.source',
                'post.read_at',
                'post.published_date',
                'post.created_at'
            ])
            .where('post.user_id = :userId', { userId });

        // Handle sorting
        const sortBy = filters.sortBy || 'added_date';
        const sortOrder = filters.sortOrder || 'DESC';

        if (sortBy === 'published_date') {
            // For published_date, handle null values - put them at the end
            query.orderBy('post.published_date', sortOrder, 'NULLS LAST');
            // Add secondary sort by sequence_id for consistent ordering
            query.addOrderBy('post.sequence_id', 'DESC');
        } else {
            // Default to sequence_id (maps to added_date)
            query.orderBy('post.sequence_id', sortOrder);
        }

        if (filters.external_links?.length) {
            query.andWhere('post.external_link IN (:...links)', { links: filters.external_links });
        }

        if (filters.read !== undefined) {
            query.andWhere('post.read_at IS ' + (filters.read ? 'NOT NULL' : 'NULL'));
        }

        if (filters.link_id) {
            query.andWhere('post.link_id = :linkId', { linkId: filters.link_id });
        }

        if (filters.search) {
            query.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)',
                { search: `%${filters.search}%` });
        }

        if (filters.source) {
            query.andWhere('post.source ILIKE :source', { source: `%${filters.source}%` });
        }

        if (filters.limit) {
            query.take(filters.limit);
        }

        if (filters.offset) {
            query.skip(filters.offset);
        }
        return await query.getManyAndCount();
    }

    async findByIdAndUser(id: string, userId: string): Promise<Post> {
        const post = await this.repository.findOne({
            where: { id, user_id: userId }
        });

        if (!post) {
            throw new HttpError(404, 'Post not found');
        }

        return post;
    }

    async updateByUser(id: string, data: UpdatePostDto, userId: string): Promise<Post> {
        const post = await this.findByIdAndUser(id, userId);
        Object.assign(post, data);
        return await this.repository.save(post);
    }

    async deleteByUser(id: string, userId: string): Promise<void> {
        const post = await this.findByIdAndUser(id, userId);
        await this.repository.remove(post);
    }

    async markAsReadByUser(id: string, userId: string): Promise<Post> {
        const post = await this.findByIdAndUser(id, userId);
        post.read_at = new Date();
        return await this.repository.save(post);
    }

    async findExpandedByIdAndUser(id: string, userId: string): Promise<PostExpanded> {
        const post = await this.findByIdAndUser(id, userId);
        const expanded = await this.expandedRepository.findOne({
            where: { post_id: post.id }
        });

        if (!expanded) {
            throw new HttpError(404, 'Expanded post data not found');
        }

        return expanded;
    }

    async getSourcesByUser(includeCount: boolean = false, userId: string): Promise<string[] | { source: string; count: number }[]> {
        if (includeCount) {
            const result = await this.repository
                .createQueryBuilder('post')
                .select('post.source', 'source')
                .addSelect('COUNT(*)', 'count')
                .where('post.source IS NOT NULL AND post.source != \'\'')
                .andWhere('post.user_id = :userId', { userId })
                .groupBy('post.source')
                .orderBy('COUNT(*)', 'DESC')
                .getRawMany();

            return result.map(row => ({
                source: row.source,
                count: parseInt(row.count)
            }));
        } else {
            const result = await this.repository
                .createQueryBuilder('post')
                .select('DISTINCT post.source', 'source')
                .where('post.source IS NOT NULL AND post.source != \'\'')
                .andWhere('post.user_id = :userId', { userId })
                .orderBy('post.source', 'ASC')
                .getRawMany();

            return result.map(row => row.source);
        }
    }

    async getSources(includeCount: boolean = false): Promise<string[] | { source: string; count: number }[]> {
        if (includeCount) {
            const result = await this.repository
                .createQueryBuilder('post')
                .select('post.source', 'source')
                .addSelect('COUNT(*)', 'count')
                .where('post.source IS NOT NULL AND post.source != \'\'')
                .groupBy('post.source')
                .orderBy('COUNT(*)', 'DESC')
                .getRawMany();

            return result.map(row => ({
                source: row.source,
                count: parseInt(row.count)
            }));
        } else {
            const result = await this.repository
                .createQueryBuilder('post')
                .select('DISTINCT post.source', 'source')
                .where('post.source IS NOT NULL AND post.source != \'\'')
                .orderBy('post.source', 'ASC')
                .getRawMany();

            return result.map(row => row.source);
        }
    }
}