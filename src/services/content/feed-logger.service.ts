import { Repository, LessThan } from 'typeorm';
import AppDataSource from '../../config/database.config';
import { FeedFetchLog } from '../../entities/feed-fetch-log.entity';
import { logger } from '../../utils/logger';

/**
 * FeedLoggerService - Manages feed fetch logging
 *
 * Responsibilities:
 * - Log all feed fetch attempts with status and timing
 * - Retrieve recent fetch logs for monitoring
 * - Cleanup old logs to manage storage
 */
export class FeedLoggerService {
    private feedFetchLogRepository: Repository<FeedFetchLog>;

    constructor() {
        this.feedFetchLogRepository = AppDataSource.getRepository(FeedFetchLog);
    }

    /**
     * Log a feed fetch attempt
     * @param feedId - The feed ID
     * @param statusCode - HTTP status code of the response
     * @param responseTimeMs - Response time in milliseconds
     * @param errorMessage - Optional error message if fetch failed
     * @param newPostsCount - Number of new posts created (default: 0)
     * @param wasModified - Whether the feed was modified (default: true)
     * @returns The created log entry
     */
    async logFetchAttempt(
        feedId: string,
        statusCode: number | null,
        responseTimeMs: number | null,
        errorMessage?: string,
        newPostsCount: number = 0,
        wasModified: boolean = true
    ): Promise<FeedFetchLog> {
        try {
            const log = this.feedFetchLogRepository.create({
                feed_id: feedId,
                status_code: statusCode ?? undefined,
                response_time_ms: responseTimeMs ?? undefined,
                error_message: errorMessage,
                new_posts_count: newPostsCount,
                was_modified: wasModified,
            });

            const savedLog = await this.feedFetchLogRepository.save(log);

            logger.info(`Feed fetch logged: ${feedId} - Status: ${statusCode}, Time: ${responseTimeMs}ms, New Posts: ${newPostsCount}`);

            return savedLog;
        } catch (error) {
            logger.error(`Error logging feed fetch for ${feedId}:`, error);
            throw error;
        }
    }

    /**
     * Get recent logs for a specific feed
     * @param feedId - The feed ID
     * @param limit - Maximum number of logs to retrieve (default: 10)
     * @returns Array of recent fetch logs ordered by date descending
     */
    async getRecentLogs(feedId: string, limit: number = 10): Promise<FeedFetchLog[]> {
        try {
            const logs = await this.feedFetchLogRepository.find({
                where: { feed_id: feedId },
                order: { fetched_at: 'DESC' },
                take: limit,
            });

            return logs;
        } catch (error) {
            logger.error(`Error retrieving logs for feed ${feedId}:`, error);
            throw error;
        }
    }

    /**
     * Delete logs older than the specified number of days
     * @param daysToKeep - Number of days to keep logs (default: 30)
     * @returns Number of deleted log entries
     */
    async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const result = await this.feedFetchLogRepository.delete({
                fetched_at: LessThan(cutoffDate),
            });

            const deletedCount = result.affected || 0;
            logger.info(`Cleaned up ${deletedCount} feed fetch logs older than ${daysToKeep} days`);

            return deletedCount;
        } catch (error) {
            logger.error(`Error cleaning up old feed logs:`, error);
            throw error;
        }
    }
}
