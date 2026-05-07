import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Feed } from '../entities/feed.entity';

export interface AdminFeedRow {
    id: string;
    name: string;
    url: string;
    status: string;
    subscriber_count: number;
    last_fetch_at: Date | null;
    added_at: Date;
    calls_24h: number;
    fail_rate_24h: number;
}

export interface FeedRepository extends Repository<Feed> {
    findAdminList(params: {
        search?: string;
        limit: number;
        offset: number;
    }): Promise<{ feeds: AdminFeedRow[]; total: number }>;
    findById(id: string): Promise<Feed | null>;
}

export const FeedRepository = AppDataSource.getRepository(Feed).extend({
    async findAdminList(params: { search?: string; limit: number; offset: number }) {
        const { search, limit, offset } = params;

        const baseQuery = this.createQueryBuilder('feed')
            .select([
                'feed.id AS id',
                'feed.name AS name',
                'feed.url AS url',
                'feed.status AS status',
                'feed.subscriber_count AS subscriber_count',
                'feed.last_fetch_at AS last_fetch_at',
                'feed.created_at AS added_at',
            ])
            .addSelect(
                `(
                    SELECT COUNT(*)::int FROM feed_fetch_logs l
                    WHERE l.feed_id = feed.id
                      AND l.fetched_at > NOW() - INTERVAL '24 hours'
                )`,
                'calls_24h'
            )
            .addSelect(
                `(
                    SELECT COUNT(*) FILTER (WHERE l.error_message IS NOT NULL OR l.status_code >= 400)::float
                         / NULLIF(COUNT(*), 0) * 100
                    FROM feed_fetch_logs l
                    WHERE l.feed_id = feed.id
                      AND l.fetched_at > NOW() - INTERVAL '24 hours'
                )`,
                'fail_rate_24h'
            );

        if (search) {
            baseQuery.where('(feed.name ILIKE :s OR feed.url ILIKE :s)', { s: `%${search}%` });
        }

        baseQuery.orderBy('feed.name', 'ASC').limit(limit).offset(offset);

        const rows = await baseQuery.getRawMany();

        const totalQuery = this.createQueryBuilder('feed');
        if (search) {
            totalQuery.where('(feed.name ILIKE :s OR feed.url ILIKE :s)', { s: `%${search}%` });
        }
        const total = await totalQuery.getCount();

        const feeds: AdminFeedRow[] = rows.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url,
            status: r.status,
            subscriber_count: Number(r.subscriber_count) || 0,
            last_fetch_at: r.last_fetch_at,
            added_at: r.added_at,
            calls_24h: Number(r.calls_24h) || 0,
            fail_rate_24h: r.fail_rate_24h != null ? Number(r.fail_rate_24h) : 0,
        }));

        return { feeds, total };
    },

    async findById(id: string) {
        return this.findOne({ where: { id } });
    },
});
