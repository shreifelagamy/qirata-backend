import { Router } from 'express';
import { errorMiddleware } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import { createChatSessionRouter } from './chat-session.routes';
import { createLinksRouter } from './links.routes';
import { createPostsRouter } from './posts.routes';
import { createSettingsRouter } from './settings.routes';

export function createRouter(): Router {
    const router = Router();

    // Apply global middleware
    router.use('/', apiLimiter);
    router.use('/', authMiddleware);

    // Mount feature routers
    router.use('/links', createLinksRouter());
    router.use('/posts', createPostsRouter());
    router.use('/settings', createSettingsRouter());
    router.use('/chat-sessions', createChatSessionRouter());

    return router;
}