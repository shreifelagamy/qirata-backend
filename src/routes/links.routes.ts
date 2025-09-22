import { Router } from 'express';
import { body } from 'express-validator';
import { LinksController } from '../controllers/links.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createLinksRouter(): Router {
    const router = Router();
    const linksController = new LinksController();

    router.post(
        '/',
        validate([
            body('url').isURL().withMessage('Must be a valid URL'),
            body('rss_url').optional().isURL().withMessage('RSS URL must be a valid URL'),
            body('title').optional().isString().trim(),
            body('description').optional().isString().trim()
        ]),
        linksController.store.bind(linksController)
    );

    router.get(
        '/',
        validate(commonValidation.pagination),
        linksController.index.bind(linksController)
    );


    router.delete(
        '/:id',
        validate(commonValidation.id()),
        linksController.destroy.bind(linksController)
    );

    router.post(
        '/:id/fetch-posts',
        validate(commonValidation.id()),
        linksController.fetchPosts.bind(linksController)
    );

    return router;
}