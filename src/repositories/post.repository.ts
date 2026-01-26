import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Post } from '../entities/post.entity';
import { PostFilters } from '../types/posts.types';

export interface PostRepository extends Repository<Post> {
    findWithUserAccess(id: string, userId: string): Promise<Post | null>;
    findWithExpandedAndUserAccess(id: string, userId: string): Promise<Post | null>;
    findAllWithUserAccess(filters: PostFilters, userId: string): Promise<{ posts: Post[]; total: number }>;
    findDistinctSources(userId: string): Promise<string[]>;
    findSourcesWithCount(userId: string): Promise<{ source: string; count: number }[]>;
}

export const PostRepository = AppDataSource.getRepository(Post).extend({
    /**
     * Find a single post with user access verification via user_feeds
     * Returns post with user-specific fields (user_read_at, user_bookmarked) mapped
     */
    async findWithUserAccess(id: string, userId: string): Promise<Post | null> {
        const result = await this.createQueryBuilder('post')
            .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
            .leftJoinAndSelect('post.feed', 'feed')
            .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
            .addSelect('up.read_at', 'user_read_at')
            .addSelect('up.bookmarked', 'user_bookmarked')
            .where('post.id = :id', { id })
            .getRawAndEntities();

        if (!result.entities.length) {
            return null;
        }

        const post = result.entities[0];
        const raw = result.raw[0];

        return {
            ...post,
            user_read_at: raw.user_read_at,
            user_bookmarked: raw.user_bookmarked
        } as Post;
    },

    /**
     * Find a single post with expanded content and user access verification via user_feeds
     * Returns post with expanded relation and user-specific fields mapped
     */
    async findWithExpandedAndUserAccess(id: string, userId: string): Promise<Post | null> {
        const result = await this.createQueryBuilder('post')
            .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
            .leftJoinAndSelect('post.feed', 'feed')
            .leftJoinAndSelect('post.expanded', 'expanded')
            .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
            .addSelect('up.read_at', 'user_read_at')
            .addSelect('up.bookmarked', 'user_bookmarked')
            .where('post.id = :id', { id })
            .getRawAndEntities();

        if (!result.entities.length) {
            return null;
        }

        const post = result.entities[0];
        const raw = result.raw[0];

        return {
            ...post,
            user_read_at: raw.user_read_at,
            user_bookmarked: raw.user_bookmarked
        } as Post;
    },

    /**
     * Find all posts with filters and user access verification
     */
    async findAllWithUserAccess(filters: PostFilters, userId: string): Promise<{ posts: Post[]; total: number }> {
        const query = this.createQueryBuilder('post')
            .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
            .leftJoinAndSelect('post.feed', 'feed')
            .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
            .addSelect('up.read_at', 'user_read_at')
            .addSelect('up.bookmarked', 'user_bookmarked');

        // Handle sorting
        const sortBy = filters.sortBy || 'added_date';
        const sortOrder = filters.sortOrder || 'DESC';

        if (sortBy === 'published_date') {
            query.orderBy('post.published_date', sortOrder, 'NULLS LAST');
            query.addOrderBy('post.sequence_id', 'DESC');
        } else {
            query.orderBy('post.sequence_id', sortOrder);
        }

        // Apply filters
        if (filters.external_links?.length) {
            query.andWhere('post.external_link IN (:...links)', { links: filters.external_links });
        }

        if (filters.read !== undefined) {
            query.andWhere('up.read_at IS ' + (filters.read ? 'NOT NULL' : 'NULL'));
        }

        if (filters.search) {
            query.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)', {
                search: `%${filters.search}%`
            });
        }

        if (filters.feed_id) {
            query.andWhere('post.feed_id = :feedId', { feedId: filters.feed_id });
        }

        if (filters.limit) {
            query.take(filters.limit);
        }

        if (filters.offset) {
            query.skip(filters.offset);
        }

        const [rawResults, total] = await Promise.all([
            query.getRawAndEntities(),
            query.getCount()
        ]);

        // Map user-specific fields to entities
        const posts = rawResults.entities.map((post, index) => {
            const raw = rawResults.raw[index];
            return {
                ...post,
                user_read_at: raw.user_read_at,
                user_bookmarked: raw.user_bookmarked
            } as Post;
        });

        return { posts, total };
    },

    /**
     * Find distinct sources for posts the user has access to
     */
    async findDistinctSources(userId: string): Promise<string[]> {
        const result = await this.createQueryBuilder('post')
            .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
            .select('DISTINCT post.source', 'source')
            .where('post.source IS NOT NULL AND post.source != \'\'')
            .orderBy('post.source', 'ASC')
            .getRawMany();

        return result.map(row => row.source);
    },
});
