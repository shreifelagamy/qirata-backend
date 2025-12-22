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