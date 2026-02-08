import { Router } from 'express';
import { body } from 'express-validator';
import { SocialPostsController } from '../controllers/social-posts.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createSocialPostsRouter(): Router {
    const router = Router({ mergeParams: true });
    const controller = new SocialPostsController();

    router.get(
        '/',
        validate([
            ...commonValidation.id('sessionId'),
        ]),
        controller.index.bind(controller)
    );

    router.put(
        '/:postId',
        validate([
            ...commonValidation.id('sessionId'),
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
        controller.update.bind(controller)
    );

    router.delete(
        '/:postId',
        validate([
            ...commonValidation.id('sessionId'),
            ...commonValidation.id('postId')
        ]),
        controller.destroy.bind(controller)
    );

    return router;
}
