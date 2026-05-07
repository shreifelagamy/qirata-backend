import { FeedFetchLogRepository, FeedRepository } from '../../../repositories';
import { HttpError } from '../../../middleware/error.middleware';
import { FeedsService } from '../feeds.service';
import { Feed } from '../../../entities/feed.entity';
import { FeedFetchLog } from '../../../entities/feed-fetch-log.entity';

export class AdminFeedsService {
    private feedsService: FeedsService;

    constructor() {
        this.feedsService = new FeedsService();
    }

    async list(params: { search?: string; limit: number; offset: number }) {
        return FeedRepository.findAdminList(params);
    }

    async getById(id: string): Promise<{ feed: Feed; stats: Awaited<ReturnType<typeof FeedFetchLogRepository.aggregate24h>> }> {
        const feed = await FeedRepository.findById(id);
        if (!feed) {
            throw new HttpError(404, 'Feed not found');
        }
        const stats = await FeedFetchLogRepository.aggregate24h(id);
        return { feed, stats };
    }

    async getLogs(id: string, params: { limit: number; offset: number }): Promise<{ logs: FeedFetchLog[]; total: number }> {
        const feed = await FeedRepository.findById(id);
        if (!feed) {
            throw new HttpError(404, 'Feed not found');
        }
        return FeedFetchLogRepository.findByFeedId(id, params);
    }

    async syncNow(id: string): Promise<FeedFetchLog> {
        const feed = await FeedRepository.findById(id);
        if (!feed) {
            throw new HttpError(404, 'Feed not found');
        }

        // Blocking call — runs the existing fetch pipeline which writes a FeedFetchLog row
        // for both success AND failure cases. We swallow non-404 errors here because the
        // failure context lives in the log row itself; surfacing a 500 would hide it.
        try {
            await this.feedsService.fetchFeed(id);
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                throw error;
            }
            // Other errors (network, parse, etc.) are already captured in a fail log row.
        }

        const log = await FeedFetchLogRepository.findLatestByFeedId(id);
        if (!log) {
            throw new HttpError(500, 'Sync completed but no fetch log was produced');
        }
        return log;
    }
}
