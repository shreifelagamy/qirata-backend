import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { FeedsController } from '../controllers/feeds.controller';
import { commonValidation, validate } from '../middleware/validation.middleware';

export function createFeedsRouter(): Router {
    const router = Router();
    const feedsController = new FeedsController();

    // GET /search - Search for feeds
    router.get(
        '/search',
        validate([
            query('q')
                .notEmpty()
                .withMessage('Search query (q) is required')
                .isString()
                .trim()
                .isLength({ min: 1 })
                .withMessage('Search query must not be empty'),
            query('limit')
                .optional()
                .isInt({ min: 1, max: 50 })
                .withMessage('Limit must be between 1 and 50')
                .toInt(),
            query('offset')
                .optional()
                .isInt({ min: 0 })
                .withMessage('Offset must be a non-negative integer')
                .toInt()
        ]),
        feedsController.searchFeeds.bind(feedsController)
    );

    // POST /discover - Discover feed from URL
    router.post(
        '/discover',
        validate([
            body('url')
                .notEmpty()
                .withMessage('URL is required')
                .isURL()
                .withMessage('Must be a valid URL')
        ]),
        feedsController.discoverFeed.bind(feedsController)
    );

    // POST /subscriptions - Subscribe to feed
    router.post(
        '/subscriptions',
        validate([
            body('feed_id')
                .optional()
                .isUUID()
                .withMessage('feed_id must be a valid UUID'),
            body('rss_url')
                .optional()
                .isURL()
                .withMessage('rss_url must be a valid URL'),
            body('custom_name')
                .optional()
                .isString()
                .trim()
                .isLength({ max: 255 })
                .withMessage('custom_name must be 255 characters or less'),
            // Custom validation: either feed_id or rss_url required, but not both
            body().custom((value, { req }) => {
                const { feed_id, rss_url } = req.body;
                if (!feed_id && !rss_url) {
                    throw new Error('Either feed_id or rss_url is required');
                }
                if (feed_id && rss_url) {
                    throw new Error('Provide either feed_id or rss_url, not both');
                }
                return true;
            })
        ]),
        feedsController.subscribeToFeed.bind(feedsController)
    );

    // GET /subscriptions - Get user subscriptions
    router.get(
        '/subscriptions',
        validate([
            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100')
                .toInt(),
            query('offset')
                .optional()
                .isInt({ min: 0 })
                .withMessage('Offset must be a non-negative integer')
                .toInt()
        ]),
        feedsController.getUserSubscriptions.bind(feedsController)
    );

    // DELETE /subscriptions/:feedId - Unsubscribe from feed
    router.delete(
        '/subscriptions/:feedId',
        validate(commonValidation.id('feedId')),
        feedsController.unsubscribeFromFeed.bind(feedsController)
    );

    return router;
}
