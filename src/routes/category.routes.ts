import { Router } from 'express';
import { body, param } from 'express-validator';
import { CategoryController } from '../controllers/category.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createCategoryRouter(): Router {
    const router = Router();
    const categoryController = new CategoryController();

    // POST /categories - Create new category
    router.post(
        '/',
        validate([
            body('name')
                .isString()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Category name must be between 1 and 100 characters')
        ]),
        categoryController.create.bind(categoryController)
    );

    // GET /categories - Get all user categories
    router.get(
        '/',
        categoryController.index.bind(categoryController)
    );

    // GET /categories/:id - Get specific category
    router.get(
        '/:id',
        validate(commonValidation.id()),
        categoryController.show.bind(categoryController)
    );

    // PUT /categories/:id - Update category
    router.put(
        '/:id',
        validate([
            ...commonValidation.id(),
            body('name')
                .optional()
                .isString()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Category name must be between 1 and 100 characters')
        ]),
        categoryController.update.bind(categoryController)
    );

    // DELETE /categories/:id - Delete category
    router.delete(
        '/:id',
        validate(commonValidation.id()),
        categoryController.destroy.bind(categoryController)
    );

    // POST /categories/:id/feeds - Move feeds to category
    router.post(
        '/:id/feeds',
        validate([
            param('id')
                .custom((value) =>
                    value === 'null' ||
                    value === 'uncategorized' ||
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
                )
                .withMessage('ID must be UUID, "null", or "uncategorized"'),
            body('feedIds')
                .isArray({ min: 1 })
                .withMessage('feedIds must be a non-empty array'),
            body('feedIds.*')
                .isUUID()
                .withMessage('Each feed ID must be a valid UUID')
        ]),
        categoryController.moveFeeds.bind(categoryController)
    );

    // GET /categories/:id/feeds - Get feeds in category
    router.get(
        '/:id/feeds',
        validate(commonValidation.id()),
        categoryController.getFeeds.bind(categoryController)
    );

    return router;
}
