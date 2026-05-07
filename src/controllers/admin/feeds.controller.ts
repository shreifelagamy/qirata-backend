import { NextFunction, Request, Response } from 'express';
import { AdminFeedsService } from '../../services/domain/admin';

const toFeedDto = (row: {
    id: string;
    name: string;
    url: string;
    status: string;
    subscriber_count: number;
    last_fetch_at: Date | null;
    added_at: Date;
    calls_24h: number;
    fail_rate_24h: number;
}) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    subscriber_count: row.subscriber_count,
    last_fetch_at: row.last_fetch_at ? row.last_fetch_at.toISOString() : null,
    added_at: row.added_at.toISOString(),
    calls_24h: row.calls_24h,
    fail_rate_24h: row.fail_rate_24h,
});

const toFeedEntityDto = (feed: {
    id: string;
    name: string;
    url: string;
    status: string;
    subscriber_count: number;
    last_fetch_at?: Date;
    created_at: Date;
}) => ({
    id: feed.id,
    name: feed.name,
    url: feed.url,
    status: feed.status,
    subscriber_count: feed.subscriber_count ?? 0,
    last_fetch_at: feed.last_fetch_at ? feed.last_fetch_at.toISOString() : null,
    added_at: feed.created_at.toISOString(),
    calls_24h: 0,
    fail_rate_24h: 0,
});

const toLogDto = (log: {
    id: string;
    fetched_at: Date;
    status_code?: number;
    response_time_ms?: number;
    error_message?: string;
    new_posts_count: number;
    was_modified: boolean;
}) => ({
    id: log.id,
    fetched_at: log.fetched_at.toISOString(),
    status_code: log.status_code ?? null,
    response_time_ms: log.response_time_ms ?? null,
    error_message: log.error_message ?? null,
    new_posts_count: log.new_posts_count,
    was_modified: log.was_modified,
});

export class AdminFeedsController {
    private service: AdminFeedsService;

    constructor() {
        this.service = new AdminFeedsService();
    }

    /**
     * @swagger
     * /admin/feeds:
     *   get:
     *     summary: List feeds with admin metrics
     *     tags: [Admin - Feeds]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: search
     *         schema: { type: string }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
     *       - in: query
     *         name: offset
     *         schema: { type: integer, minimum: 0, default: 0 }
     *     responses:
     *       200: { description: Feed list with subscriber counts and 24h aggregates }
     *       403: { description: Admin access required }
     */
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const search = typeof req.query.search === 'string' ? req.query.search : undefined;
            const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
            const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);

            const result = await this.service.list({ search, limit, offset });
            res.json({
                data: {
                    feeds: result.feeds.map(toFeedDto),
                    total: result.total,
                },
                status: 200,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * @swagger
     * /admin/feeds/{id}:
     *   get:
     *     summary: Get a feed with 24h KPI stats
     *     tags: [Admin - Feeds]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string, format: uuid }
     *     responses:
     *       200: { description: Feed and 24h aggregates }
     *       404: { description: Feed not found }
     */
    detail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { feed, stats } = await this.service.getById(req.params.id);
            res.json({
                data: {
                    feed: toFeedEntityDto(feed),
                    stats,
                },
                status: 200,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * @swagger
     * /admin/feeds/{id}/logs:
     *   get:
     *     summary: List fetch logs for a feed
     *     tags: [Admin - Feeds]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string, format: uuid }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
     *       - in: query
     *         name: offset
     *         schema: { type: integer, minimum: 0, default: 0 }
     *     responses:
     *       200: { description: Paginated fetch logs }
     *       404: { description: Feed not found }
     */
    logs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
            const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
            const result = await this.service.getLogs(req.params.id, { limit, offset });
            res.json({
                data: {
                    logs: result.logs.map(toLogDto),
                    total: result.total,
                },
                status: 200,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * @swagger
     * /admin/feeds/{id}/sync:
     *   post:
     *     summary: Force-fetch a feed now (blocking)
     *     tags: [Admin - Feeds]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string, format: uuid }
     *     responses:
     *       200: { description: New fetch log produced by the sync }
     *       404: { description: Feed not found }
     */
    sync = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const log = await this.service.syncNow(req.params.id);
            res.json({
                data: { log: toLogDto(log) },
                status: 200,
            });
        } catch (err) {
            next(err);
        }
    };
}
