import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { FeedFetchLog } from '../entities/feed-fetch-log.entity';

export interface FeedAggregate24h {
    calls24h: number;
    success: number;
    failed: number;
    avgResponseMs: number | null;
}

export interface FeedFetchLogRepository extends Repository<FeedFetchLog> {
    findByFeedId(feedId: string, params: { limit: number; offset: number }): Promise<{ logs: FeedFetchLog[]; total: number }>;
    findLatestByFeedId(feedId: string): Promise<FeedFetchLog | null>;
    aggregate24h(feedId: string): Promise<FeedAggregate24h>;
}

export const FeedFetchLogRepository = AppDataSource.getRepository(FeedFetchLog).extend({
    async findByFeedId(feedId: string, params: { limit: number; offset: number }) {
        const [logs, total] = await this.findAndCount({
            where: { feed_id: feedId },
            order: { fetched_at: 'DESC' },
            take: params.limit,
            skip: params.offset,
        });
        return { logs, total };
    },

    async findLatestByFeedId(feedId: string) {
        return this.findOne({
            where: { feed_id: feedId },
            order: { fetched_at: 'DESC' },
        });
    },

    async aggregate24h(feedId: string): Promise<FeedAggregate24h> {
        const row = await this.createQueryBuilder('l')
            .select('COUNT(*)::int', 'calls_24h')
            .addSelect(
                `COUNT(*) FILTER (WHERE l.error_message IS NULL AND (l.status_code IS NULL OR l.status_code < 400))::int`,
                'success'
            )
            .addSelect(
                `COUNT(*) FILTER (WHERE l.error_message IS NOT NULL OR l.status_code >= 400)::int`,
                'failed'
            )
            .addSelect('AVG(l.response_time_ms)::float', 'avg_ms')
            .where('l.feed_id = :feedId', { feedId })
            .andWhere(`l.fetched_at > NOW() - INTERVAL '24 hours'`)
            .getRawOne<{ calls_24h: string; success: string; failed: string; avg_ms: string | null }>();

        return {
            calls24h: Number(row?.calls_24h) || 0,
            success: Number(row?.success) || 0,
            failed: Number(row?.failed) || 0,
            avgResponseMs: row?.avg_ms != null ? Math.round(Number(row.avg_ms)) : null,
        };
    },
});
