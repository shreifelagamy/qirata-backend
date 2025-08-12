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
            ...commonValidation.cursorPagination
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
            body('image_urls.*').optional().isURL().withMessage('Each image URL must be valid'),
            body('code_examples').optional().isArray().withMessage('Code examples must be an array'),
            body('code_examples.*.language').optional().isString().withMessage('Code example language must be a string'),
            body('code_examples.*.code').optional().isString().withMessage('Code example code must be a string'),
            body('code_examples.*.description').optional().isString().withMessage('Code example description must be a string'),
            body('visual_elements').optional().isArray().withMessage('Visual elements must be an array'),
            body('visual_elements.*.type').optional().isString().withMessage('Visual element type must be a string'),
            body('visual_elements.*.description').optional().isString().withMessage('Visual element description must be a string'),
            body('visual_elements.*.suggestion').optional().isString().withMessage('Visual element suggestion must be a string')
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
