import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { DataSource } from 'typeorm';
import { auth } from './config/auth.config';
import { setupSwagger } from './config/swagger.config';
import * as entities from './entities';
import { errorMiddleware, HttpError } from './middleware/error.middleware';
import { createRouter } from './routes';
import { DatabaseFileLogger } from './utils/database-logger';
import { socketService } from './websocket/socket.service';

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
    synchronize: false,
    logging: process.env.NODE_ENV === 'development' ? ["query", "error", "schema", "warn", "migration"] : false,
    logger: process.env.NODE_ENV === 'development' ? new DatabaseFileLogger() : undefined,
    entities: Object.values(entities),
    migrations: [__dirname + "/database/migrations/**/*.{ts,js}"],
    migrationsTableName: "migrations"
});

app.use(cors({
    origin: [
        'http://localhost:5173', // Frontend dev server
        'http://localhost:3000', // Backend API
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []), // Production frontend
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []) // Additional origins
    ],
    credentials: true, // Essential for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control', 'Accept', 'Accept-Language', 'DNT', 'Origin', 'Referer', 'Sec-Fetch-Dest', 'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'User-Agent', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']
}));

// Security middleware with environment-specific configuration
if (process.env.NODE_ENV === 'production') {
    // Production: Strict security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net" // Allow Better Auth Scalar API reference
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'", // Allow inline styles for Better Auth
                    "https://cdn.jsdelivr.net", // Allow Better Auth Scalar styles
                    "https://fonts.googleapis.com" // Allow Google Fonts
                ],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
                fontSrc: [
                    "'self'",
                    "https:",
                    "https://fonts.gstatic.com" // Allow Google Fonts
                ],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false, // Allow Better Auth iframe operations
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        }
    }));
} else {
    // Development: Relaxed settings for debugging and Swagger UI
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'", // Swagger UI needs unsafe-eval
                    "https://cdn.jsdelivr.net", // Allow Better Auth Scalar API reference
                    "https://unpkg.com" // Allow other CDN resources if needed
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net", // Allow Better Auth Scalar styles
                    "https://fonts.googleapis.com" // Allow Google Fonts
                ],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*"], // Allow dev server connections
                fontSrc: [
                    "'self'",
                    "https:",
                    "data:",
                    "https://fonts.gstatic.com" // Allow Google Fonts
                ],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"], // Allow iframes in development
            },
        },
        crossOriginEmbedderPolicy: false, // Disable for Better Auth compatibility
        hsts: false // Disable HSTS in development (HTTP allowed)
    }));
}



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
        const apiRouter = createRouter();
        app.use(morgan('dev'));
        app.all("/api/auth/*", toNodeHandler(auth));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

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