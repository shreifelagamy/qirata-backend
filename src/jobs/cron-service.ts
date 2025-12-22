import * as cron from 'node-cron';
import dotenv from 'dotenv';
import { feedFetcherTask } from './tasks/feed-fetcher.task';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Cron schedule configuration (can be overridden via environment variables)
const FEED_FETCHER_SCHEDULE = process.env.FEED_FETCHER_SCHEDULE || '0 2 * * *'; // Default: Daily at 2 AM

/**
 * Cron Service Entry Point
 *
 * Runs independently from the main Express API
 * Schedules tasks without maintaining persistent DB connections
 * Each task handles its own DB connection lifecycle
 */
async function startCronService(): Promise<void> {
    try {
        logger.info('========================================');
        logger.info('Initializing Cron Service');
        logger.info('========================================');

        // Schedule Feed Fetcher Task
        cron.schedule(FEED_FETCHER_SCHEDULE, async () => {
            try {
                logger.info('Cron job triggered: Feed Fetcher');
                await feedFetcherTask();
                logger.info('Feed fetcher task completed successfully');
            } catch (error) {
                logger.error('Error running scheduled feed fetcher task:', error);
            }
        });

        logger.info('✓ Feed fetcher task scheduled successfully');
        logger.info('========================================');
        logger.info('Cron Service is running');
        logger.info(`Feed Fetcher Schedule: ${FEED_FETCHER_SCHEDULE}`);
        logger.info('Press Ctrl+C to stop');
        logger.info('========================================');

    } catch (error) {
        logger.error('Fatal error initializing cron service:', error);
        process.exit(1);
    }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`\n${signal} received, shutting down gracefully...`);

    try {
        logger.info('✓ Cron service stopped');
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the service
startCronService();
