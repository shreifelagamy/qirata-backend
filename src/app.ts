import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { DataSource } from 'typeorm';
import { setupSwagger } from './config/swagger.config';
import * as entities from './entities';
import { errorMiddleware, HttpError } from './middleware/error.middleware';
import { createRouter } from './routes';
import { socketService } from './websocket/socket.service';
import { DatabaseFileLogger } from './utils/database-logger';

// Load environment variables
dotenv.config();

// Create Express app
const app: Express = express();
const httpServer = createServer(app);

// Database configuration
export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development' ? ["query", "error", "schema", "warn", "migration"] : false,
    logger: process.env.NODE_ENV === 'development' ? new DatabaseFileLogger() : undefined,
    entities: Object.values(entities),
    migrations: [__dirname + "/database/migrations/**/*.{ts,js}"],
    migrationsTableName: "migrations"
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Swagger documentation (only in development)
if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
}

// Health check route
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK' });
});

// Create and mount API router after database initialization
AppDataSource.initialize()
    .then(() => {
        console.log('Database connection established');
        const apiRouter = createRouter();
        app.use('/api/v1', apiRouter);

        // Add 404 handler AFTER all routes
        app.use((req: Request, res: Response, next: NextFunction) => {
            const error = new HttpError(404, `Route ${req.path} not found`);
            next(error);
        });

        // Add error handler LAST
        app.use(errorMiddleware);

    })
    .catch((error) => {
        console.error('Database connection failed:', error);
    });

// Initialize WebSocket service
socketService.initializeSocket(httpServer);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;