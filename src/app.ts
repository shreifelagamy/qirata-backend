import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import path from 'path';
import { DataSource } from 'typeorm';
import { auth } from './config/auth.config';
import { errorMiddleware, HttpError } from './middleware/error.middleware';
import { getDatabaseConfig, isDevelopment, isProduction, LazyLoader, startupProfiler } from './utils/startup-optimizer';

// Start timing the application startup
startupProfiler.startTimer('total-startup');
startupProfiler.startTimer('env-config');

// Load environment variables
dotenv.config();
startupProfiler.log('env-config');

// Create Express app and HTTP server immediately
startupProfiler.startTimer('express-setup');
const app: Express = express();
const httpServer = createServer(app);
startupProfiler.log('express-setup');

// Optimized database configuration
startupProfiler.startTimer('db-config');
export const AppDataSource = new DataSource(getDatabaseConfig());
startupProfiler.log('db-config');

// Essential middleware setup (minimal for fast startup)
startupProfiler.startTimer('essential-middleware');

// CORS setup
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control', 'Accept', 'Accept-Language', 'DNT', 'Origin', 'Referer', 'Sec-Fetch-Dest', 'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'User-Agent', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']
}));

// Better Auth routes (BEFORE body parsing to avoid conflicts)
app.all("/api/auth/*", toNodeHandler(auth));

// Basic parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static test page(s)
app.use(express.static(path.join(__dirname, '../public')));

// Minimal logging in production
if (isProduction) {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

startupProfiler.log('essential-middleware');

// Health check route (available immediately)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Lazy load Helmet security middleware
const getHelmet = () => LazyLoader.getInstance('helmet', () => {
    startupProfiler.startTimer('helmet-config');

    const helmetConfig = isProduction ? {
        // Production: Strict security headers
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:"],
                fontSrc: ["'self'", "https:", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    } : {
        // Development: Relaxed settings
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*"],
                fontSrc: ["'self'", "https:", "data:", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: false
    };

    startupProfiler.log('helmet-config');
    return helmet(helmetConfig);
});

// Apply helmet middleware lazily
app.use(async (req: Request, res: Response, next: NextFunction) => {
    const helmetMiddleware = await getHelmet();
    helmetMiddleware(req, res, next);
});

// Setup Swagger documentation (development only)
if (isDevelopment) {
    // Import and setup Swagger immediately in development
    import('./config/swagger.config').then(({ setupSwagger }) => {
        startupProfiler.startTimer('swagger-setup');
        setupSwagger(app);
        startupProfiler.log('swagger-setup');
        console.log('📚 Swagger documentation available at /api-docs');
    });
}

// Start HTTP server first (for immediate health check responses)
const PORT = process.env.PORT || 3000;
const server = httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (${startupProfiler.getTotalTime()}ms)`);
});

// Handle server errors
server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please stop other services or use a different port.`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
        process.exit(1);
    }
});

// Initialize database connection in background
const initializeDatabase = async () => {
    startupProfiler.startTimer('db-connection');

    // Debug: Log database configuration (without sensitive data)
    console.log('🔍 Database connection debug info:');
    console.log(`   Host: ${process.env.DB_HOST || 'NOT SET'}`);
    console.log(`   Port: ${process.env.DB_PORT || '5432 (default)'}`);
    console.log(`   Database: ${process.env.DB_DATABASE || 'NOT SET'}`);
    console.log(`   Username: ${process.env.DB_USERNAME ? 'SET' : 'NOT SET'}`);
    console.log(`   Password: ${process.env.DB_PASSWORD ? 'SET' : 'NOT SET'}`);
    console.log(`   Node ENV: ${process.env.NODE_ENV || 'NOT SET'}`);

    try {
        console.log('🔌 Attempting database connection...');
        await AppDataSource.initialize();
        startupProfiler.log('db-connection');

        // Mount API routes after DB is ready
        startupProfiler.startTimer('routes-setup');
        const { createRouter } = await import('./routes');
        const apiRouter = createRouter();
        app.use('/api/v1', apiRouter);
        startupProfiler.log('routes-setup');

        // Add error handling AFTER routes
        app.use((req: Request, res: Response, next: NextFunction) => {
            const error = new HttpError(404, `Route ${req.path} not found`);
            next(error);
        });

        app.use(errorMiddleware);

        console.log(`✅ Database connected and routes mounted (${startupProfiler.getTotalTime()}ms)`);

    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error('   Error details:', error);
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
        }
        // Don't exit - keep server running for health checks

        // Add fallback route for database errors
        app.use('/api/v1/*', (req: Request, res: Response) => {
            res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'Database connection failed'
            });
        });
    }
};

// Initialize WebSocket service lazily
const initializeWebSocket = async () => {
    const { socketService } = await import('./websocket/socket.service');
    socketService.initializeSocket(httpServer);
    console.log(`🔌 WebSocket service initialized`);
};

// Background initialization (non-blocking)
Promise.all([
    initializeDatabase(),
    initializeWebSocket()
]).then(() => {
    startupProfiler.log('total-startup');
    console.log(`🎉 Application fully initialized (${startupProfiler.getTotalTime()}ms)`);
}).catch(error => {
    console.error('❌ Background initialization failed:', error);
});

export default app;
