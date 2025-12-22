import * as cron from 'node-cron';
import dotenv from 'dotenv';
import AppDataSource from '../config/database.config';
import { feedFetcherTask } from './tasks/feed-fetcher.task';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Cron Service Entry Point
 *
 * Runs independently from the main Express API
 * Schedules feed fetching to run daily at 2 AM server time
 */
async function startCronService(): Promise<void> {
    try {
        logger.info('========================================');
        logger.info('Initializing Cron Service');
        logger.info('========================================');

        // Initialize database connection
        logger.info('Connecting to database...');
        await AppDataSource.initialize();
        logger.info('✓ Database connected successfully');

        // Get cron schedule from environment or use default (2 AM daily)
        const cronSchedule = process.env.CRON_FEED_FETCH_SCHEDULE || '* * * * *';
        const enabled = process.env.CRON_FEED_FETCH_ENABLED !== 'false';

        if (!enabled) {
            logger.warn('Feed fetcher cron job is disabled (CRON_FEED_FETCH_ENABLED=false)');
            logger.info('Service will stay running but no jobs will be scheduled');
            return;
        }

        // Schedule feed fetcher task
        logger.info(`Scheduling feed fetcher task: ${cronSchedule} (daily at 2 AM server time)`);

        cron.schedule(cronSchedule, async () => {
            try {
                logger.info('Cron job triggered: Feed Fetcher');
                await feedFetcherTask();
            } catch (error) {
                logger.error('Error running scheduled feed fetcher task:', error);
            }
        });

        logger.info('✓ Feed fetcher task scheduled successfully');
        logger.info('========================================');
        logger.info('Cron Service is running');
        logger.info(`Schedule: ${cronSchedule}`);
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
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            logger.info('✓ Database connection closed');
        }

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
