import * as entities from '../entities';
import { DataSourceOptions } from 'typeorm';
import { DatabaseFileLogger } from './database-logger';

interface StartupTimer {
    start: number;
    name: string;
}

class StartupProfiler {
    private timers: Map<string, StartupTimer> = new Map();
    private startTime: number = Date.now();

    startTimer(name: string): void {
        this.timers.set(name, {
            start: Date.now(),
            name
        });
    }

    endTimer(name: string): number {
        const timer = this.timers.get(name);
        if (!timer) {
            return 0;
        }
        const duration = Date.now() - timer.start;
        this.timers.delete(name);
        return duration;
    }

    getTotalTime(): number {
        return Date.now() - this.startTime;
    }

    log(name: string): void {
        const duration = this.endTimer(name);
        console.log(`⚡ ${name}: ${duration}ms`);
    }
}

export const startupProfiler = new StartupProfiler();

// Lazy loading utilities
export class LazyLoader {
    private static instances: Map<string, any> = new Map();

    static async getInstance<T>(
        key: string,
        factory: () => Promise<T> | T
    ): Promise<T> {
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        const instance = await factory();
        this.instances.set(key, instance);
        return instance;
    }

    static hasInstance(key: string): boolean {
        return this.instances.has(key);
    }
}

// Environment-specific optimizations
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Production-optimized database configuration
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
        logger: process.env.NODE_ENV === 'development' ? new DatabaseFileLogger() : undefined,
        extra: {
            max: 5,
            min: 1
        }
    };
};