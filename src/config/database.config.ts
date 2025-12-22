import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { configDotenv } from 'dotenv';
import * as entities from '../entities';
import { DatabaseFileLogger } from '../utils/database-logger';

configDotenv();

// Environment helpers
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Get Database Configuration
 *
 * Returns environment-specific database configuration:
 * - Production: Optimized for free-tier hosting with connection pooling
 * - Development: Enhanced logging and debugging
 */
export const getDatabaseConfig = (): DataSourceOptions => {
    const baseConfig = {
        type: "postgres" as const,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "5432"),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        synchronize: false,
        entities: Object.values(entities),
        migrations: [__dirname + "/../database/migrations/**/*.{ts,js}"],
        migrationsTableName: "migrations"
    };

    if (isProduction) {
        return {
            ...baseConfig,
            // Production optimizations for free tier
            logging: false,
            cache: {
                duration: 30000 // 30 second query cache
            },
            maxQueryExecutionTime: 5000,
            // Optimized connection pooling for Render free tier
            extra: {
                max: 3, // Small pool for free tier
                min: 1,
                acquireTimeoutMillis: 8000,
                createTimeoutMillis: 8000,
                destroyTimeoutMillis: 3000,
                idleTimeoutMillis: 30000,
                reapIntervalMillis: 1000,
                createRetryIntervalMillis: 200,
                // Connection keep-alive for sleeping containers
                keepAlive: true,
                keepAliveInitialDelayMillis: 10000
            }
        };
    }

    // Development configuration
    return {
        ...baseConfig,
        logging: ["error", "warn"],
        logger: isDevelopment ? new DatabaseFileLogger() : undefined,
        extra: {
            max: 5,
            min: 1
        }
    };
};

/**
 * Shared Database Configuration
 *
 * This AppDataSource is used by both:
 * - Main Express API (app.ts)
 * - Cron Service (jobs/cron-service.ts)
 * - Migration commands
 */
export default new DataSource(getDatabaseConfig());
