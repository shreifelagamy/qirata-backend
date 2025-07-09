import { Router } from 'express';
import { body } from 'express-validator';
import { ChatSessionController } from '../controllers/chat-session.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createChatSessionRouter(): Router {
    const router = Router();
    const controller = new ChatSessionController();

    // Basic CRUD endpoints
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

    // Message management endpoints
    router.get(
        '/:id/messages',
        validate([
            ...commonValidation.id(),
            ...commonValidation.pagination
        ]),
        controller.getMessages.bind(controller)
    );

    // Social posts endpoints
    router.get(
        '/:id/social-posts',
        validate([
            ...commonValidation.id(),
        ]),
        controller.getSocialPosts.bind(controller)
    );

    router.put(
        '/:id/social-posts/:postId',
        validate([
            ...commonValidation.id(),
            ...commonValidation.id('postId'),
            body('content').isString().trim().notEmpty().withMessage('Content is required'),
            body('image_urls').optional().isArray().withMessage('Image URLs must be an array'),
            body('image_urls.*').optional().isURL().withMessage('Each image URL must be valid')
        ]),
        controller.updateSocialPost.bind(controller)
    );

    router.delete(
        '/:id/social-posts/:postId',
        validate([
            ...commonValidation.id(),
            ...commonValidation.id('postId')
        ]),
        controller.deleteSocialPost.bind(controller)
    );

    return router;
}
