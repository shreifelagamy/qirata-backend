import { NextFunction, Request, Response } from 'express';
import { FeedsService } from '../services/feeds.service';
import { logger } from '../utils/logger';

export class FeedsController {
    private feedsService: FeedsService;

    constructor() {
        this.feedsService = new FeedsService();
    }

    /**
     * @swagger
     * /feeds/search:
     *   get:
     *     summary: Search for feeds
     *     description: Search for feeds in the global registry by name or URL with fuzzy matching
     *     tags: [Feeds]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: q
     *         required: true
     *         schema:
     *           type: string
     *           minLength: 1
     *         description: Search query string
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 50
     *           default: 20
     *         description: Maximum number of results to return
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           minimum: 0
     *           default: 0
     *         description: Number of results to skip
     *     responses:
     *       200:
     *         description: Search results
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     feeds:
     *                       type: array
     *                       items:
     *                         $ref: '#/components/schemas/Feed'
     *                     total:
     *                       type: integer
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request - Missing or invalid query
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async searchFeeds(req: Request, res: Response, next: NextFunction) {
        try {
            const { q, limit = 20, offset = 0 } = req.query;

            const result = await this.feedsService.searchFeeds(q as string, {
                limit: parseInt(limit as string, 10),
                offset: parseInt(offset as string, 10)
            });

            logger.info(`Search feeds: query="${q}", results=${result.feeds.length}`);
            res.status(200).json({ data: result, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /feeds/discover:
     *   post:
     *     summary: Discover RSS feeds from a URL
     *     description: Scrapes a URL to discover RSS feeds. Returns single feed or array of feeds if multiple found.
     *     tags: [Feeds]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - url
     *             properties:
     *               url:
     *                 type: string
     *                 format: uri
     *                 description: URL to discover feeds from
     *     responses:
     *       200:
     *         description: Feed(s) discovered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   oneOf:
     *                     - $ref: '#/components/schemas/Feed'
     *                     - type: array
     *                       items:
     *                         $ref: '#/components/schemas/Feed'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request - Invalid URL or no RSS feed found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       422:
     *         description: Unprocessable Entity - Found RSS links but none valid
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       503:
     *         description: Service Unavailable - Unable to access URL
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async discoverFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { url } = req.body;

            const result = await this.feedsService.discoverFeedFromUrl(url);

            logger.info(`Feed discovered from URL: ${url}`);
            res.status(200).json({ data: result, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /feeds/subscriptions:
     *   post:
     *     summary: Subscribe to a feed
     *     description: Subscribe user to a feed by feed_id or rss_url. Creates feed if using rss_url and feed doesn't exist.
     *     tags: [Feeds]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               feed_id:
     *                 type: string
     *                 format: uuid
     *                 description: Feed ID to subscribe to (mutually exclusive with rss_url)
     *               rss_url:
     *                 type: string
     *                 format: uri
     *                 description: RSS URL to subscribe to (mutually exclusive with feed_id)
     *               custom_name:
     *                 type: string
     *                 maxLength: 255
     *                 description: Optional custom name for the feed
     *             oneOf:
     *               - required: [feed_id]
     *               - required: [rss_url]
     *     responses:
     *       201:
     *         description: Subscription created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/UserFeed'
     *                 status:
     *                   type: integer
     *                   example: 201
     *       400:
     *         description: Bad request - Missing or invalid parameters
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Feed not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       409:
     *         description: Conflict - Already subscribed to this feed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       422:
     *         description: Unprocessable Entity - Invalid RSS feed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async subscribeToFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { feed_id, rss_url, custom_name } = req.body;
            const userId = req.user!.id;

            let subscription;

            if (feed_id) {
                subscription = await this.feedsService.subscribeUserToFeed(
                    userId,
                    feed_id,
                    custom_name
                );
            } else {
                subscription = await this.feedsService.subscribeUserByRssUrl(
                    userId,
                    rss_url,
                    custom_name
                );
            }

            logger.info(`User ${userId} subscribed to feed`);
            res.status(201).json({ data: subscription, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /feeds/subscriptions:
     *   get:
     *     summary: Get user's feed subscriptions
     *     description: Retrieve all feed subscriptions for the authenticated user with pagination
     *     tags: [Feeds]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 50
     *         description: Number of items per page
     *     responses:
     *       200:
     *         description: User subscriptions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     items:
     *                       type: array
     *                       items:
     *                         $ref: '#/components/schemas/UserFeed'
     *                     total:
     *                       type: integer
     *                     page:
     *                       type: integer
     *                     pageSize:
     *                       type: integer
     *                     totalPages:
     *                       type: integer
     *                 status:
     *                   type: integer
     *                   example: 200
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async getUserSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;
            const userId = req.user!.id;

            const result = await this.feedsService.getUserSubscriptions(userId, {
                limit: pageSize,
                offset: (page - 1) * pageSize
            });

            const totalPages = Math.ceil(result.total / pageSize);

            logger.info(`Retrieved ${result.subscriptions.length} subscriptions for user ${userId}`);
            res.status(200).json({
                data: {
                    items: result.subscriptions,
                    total: result.total,
                    page,
                    pageSize,
                    totalPages
                },
                status: 200
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /feeds/subscriptions/{feedId}:
     *   delete:
     *     summary: Unsubscribe from a feed
     *     description: Remove user's subscription to a specific feed
     *     tags: [Feeds]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: feedId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Feed ID to unsubscribe from
     *     responses:
     *       200:
     *         description: Unsubscribed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     message:
     *                       type: string
     *                       example: "Unsubscribed successfully"
     *                 status:
     *                   type: integer
     *                   example: 200
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Subscription not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async unsubscribeFromFeed(req: Request, res: Response, next: NextFunction) {
        try {
            const { feedId } = req.params;
            const userId = req.user!.id;

            await this.feedsService.unsubscribeUser(userId, feedId);

            logger.info(`User ${userId} unsubscribed from feed ${feedId}`);
            res.status(200).json({
                data: { message: 'Unsubscribed successfully' },
                status: 200
            });
        } catch (error) {
            next(error);
        }
    }
}
