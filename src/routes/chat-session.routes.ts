import { Router } from 'express';
import { body } from 'express-validator';
import { ChatSessionController } from '../controllers/chat-session.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';
import { createMessagesRouter } from './messages.routes';
import { createSocialPostsRouter } from './social-posts.routes';

export function createChatSessionRouter(): Router {
    const router = Router();
    const controller = new ChatSessionController();

    // Chat session CRUD
    router.post(
        '/',
        validate([
            body('title').isString().trim().notEmpty().withMessage('Title is required'),
            body('postId').optional().isUUID().withMessage('postId must be a valid UUID')
        ]),
        controller.store.bind(controller)
    );

    router.get(
        '/',
        validate([...commonValidation.pagination]),
        controller.index.bind(controller)
    );

    router.get(
        '/:id',
        validate(commonValidation.id()),
        controller.show.bind(controller)
    );

    // Favorite toggle endpoint
    router.patch(
        '/:id/favorite',
        validate(commonValidation.id()),
        controller.toggleFavorite.bind(controller)
    );

    // Mount sub-resource routers
    router.use('/:sessionId/messages', createMessagesRouter());
    router.use('/:sessionId/social-posts', createSocialPostsRouter());

    return router;
}
