import { FeedService } from '../../services/content/feed.service';
import AppDataSource from '../../config/database.config';
import { logger } from '../../utils/logger';

/**
 * Feed Fetcher Task
 *
 * Fetches all active feeds in parallel batches
 * Logs progress and handles errors gracefully
 */
export async function feedFetcherTask(): Promise<void> {
    const startTime = Date.now();
    logger.info('========================================');
    logger.info('Starting feed fetcher task');
    logger.info('========================================');

    try {
        // Ensure database is initialized
        if (!AppDataSource.isInitialized) {
            logger.info('Initializing database connection...');
            await AppDataSource.initialize();
            logger.info('Database connected');
        }

        // Initialize FeedService
        const feedService = new FeedService();

        // Get feeds that need to be fetched (max 1000)
        const feeds = await feedService.getFeedsToFetch(1000);

        if (!feeds || feeds.length === 0) {
            logger.info('No feeds to fetch');
            return;
        }

        logger.info(`Found ${feeds.length} feeds to process`);

        // Process feeds in batches of 10
        const BATCH_SIZE = 10;
        let successCount = 0;
        let errorCount = 0;
        let notModifiedCount = 0;
        let totalNewPosts = 0;

        for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
            const batch = feeds.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(feeds.length / BATCH_SIZE);

            logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} feeds)`);

            // Process batch in parallel using Promise.allSettled
            const results = await Promise.allSettled(
                batch.map(async (feed) => {
                    try {
                        const result = await feedService.fetchFeed(feed.id);
                        return {
                            feedId: feed.id,
                            feedUrl: feed.url,
                            success: true,
                            insertedCount: result.insertedCount,
                        };
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        logger.error(`Error fetching feed ${feed.url}:`, errorMessage);
                        return {
                            feedId: feed.id,
                            feedUrl: feed.url,
                            success: false,
                            error: errorMessage,
                        };
                    }
                })
            );

            // Process results
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        successCount++;
                        const insertedCount = result.value.insertedCount ?? 0;
                        if (insertedCount > 0) {
                            totalNewPosts += insertedCount;
                            logger.info(
                                `✓ ${result.value.feedUrl}: ${insertedCount} new posts`
                            );
                        } else {
                            notModifiedCount++;
                            logger.debug(`○ ${result.value.feedUrl}: Not modified (304)`);
                        }
                    } else {
                        errorCount++;
                        logger.error(`✗ ${result.value.feedUrl}: ${result.value.error}`);
                    }
                } else {
                    errorCount++;
                    logger.error(`✗ Batch item ${index} failed:`, result.reason);
                }
            });

            // Log progress after each batch
            const processed = Math.min(i + BATCH_SIZE, feeds.length);
            logger.info(
                `Progress: ${processed}/${feeds.length} feeds processed ` +
                `(${successCount} success, ${errorCount} errors)`
            );
        }

        // Calculate duration
        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(2);

        // Log final summary
        logger.info('========================================');
        logger.info('Feed fetcher task completed');
        logger.info(`Total feeds processed: ${feeds.length}`);
        logger.info(`Successful: ${successCount}`);
        logger.info(`Not modified (304): ${notModifiedCount}`);
        logger.info(`Errors: ${errorCount}`);
        logger.info(`Total new posts created: ${totalNewPosts}`);
        logger.info(`Duration: ${durationSeconds}s`);
        logger.info('========================================');

    } catch (error) {
        logger.error('Fatal error in feed fetcher task:', error);
        throw error;
    } finally {
        // Close database connection after task completion
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            logger.info('Database connection closed');
        }
    }
}
