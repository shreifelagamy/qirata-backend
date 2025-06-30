import { Logger } from 'typeorm';
import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

export class DatabaseFileLogger implements Logger {
    private logPath: string;

    constructor() {
        // Create logs directory if it doesn't exist
        const logsDir = join(process.cwd(), 'logs');
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }

        this.logPath = join(logsDir, 'database.log');

        // Create log file if it doesn't exist
        if (!existsSync(this.logPath)) {
            writeFileSync(this.logPath, '');
        }
    }

    private writeLog(level: string, message: string, parameters?: any[]): void {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        if (parameters && parameters.length > 0) {
            const params = parameters.map(p =>
                typeof p === 'object' ? JSON.stringify(p) : String(p)
            ).join(', ');
            appendFileSync(this.logPath, `${logEntry} | Parameters: [${params}]\n`);
        } else {
            appendFileSync(this.logPath, `${logEntry}\n`);
        }
    }

    logQuery(query: string, parameters?: any[]): void {
        this.writeLog('QUERY', query, parameters);
    }

    logQueryError(error: string | Error, query: string, parameters?: any[]): void {
        const errorMessage = error instanceof Error ? error.message : error;
        this.writeLog('QUERY_ERROR', `${errorMessage} | Query: ${query}`, parameters);
    }

    logQuerySlow(time: number, query: string, parameters?: any[]): void {
        this.writeLog('SLOW_QUERY', `Execution time: ${time}ms | Query: ${query}`, parameters);
    }

    logSchemaBuild(message: string): void {
        this.writeLog('SCHEMA', message);
    }

    logMigration(message: string): void {
        this.writeLog('MIGRATION', message);
    }

    log(level: 'log' | 'info' | 'warn', message: any): void {
        this.writeLog(level, String(message));
    }
}