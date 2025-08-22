import { NextFunction, Request, Response } from 'express';
import { CreateLinkDto, UpdateLinkDto } from '../dtos/link.dto';
import { LinksService } from '../services/links.service';
import { logger } from '../utils/logger';

export class LinksController {
    private linksService: LinksService;

    constructor() {
        this.linksService = new LinksService();
    }

    /**
     * @swagger
     * /links:
     *   post:
     *     summary: Create a new link
     *     description: Creates a new link and automatically detects RSS feeds. If multiple feeds are found, returns them for user selection.
     *     tags: [Links]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateLinkDto'
     *     responses:
     *       201:
     *         description: Link created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Link'
     *       300:
     *         description: Multiple RSS feeds found - user selection required
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "Multiple RSS feeds found. Please select one."
     *                 feeds:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       url:
     *                         type: string
     *                       title:
     *                         type: string
     *                 originalUrl:
     *                   type: string
     *                 name:
     *                   type: string
     *       400:
     *         description: Bad request - Invalid URL, missing RSS feed, or validation error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               no_rss_feed:
     *                 summary: No RSS feed found
     *                 value:
     *                   message: "No RSS feed found for this URL. We currently only accept blogs with public RSS feeds."
     *               invalid_url:
     *                 summary: Invalid URL
     *                 value:
     *                   message: "URL is required"
     *               duplicate_url:
     *                 summary: Duplicate URL
     *                 value:
     *                   message: "URL already exists"
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async store(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const data: CreateLinkDto = req.body;

            // Process the link and handle RSS detection
            const result = await this.linksService.processLink(data);

            // If multiple feeds were found, return them for user selection
            if (result.multipleFeeds) {
                return res.status(300).json({
                    message: 'Multiple RSS feeds found. Please select one.',
                    feeds: result.multipleFeeds,
                    originalUrl: data.url,
                    name: data.name || new URL(data.url).hostname,
                });
            }

            // Create the link with processed data
            const link = await this.linksService.addLink(result.linkData, req.user!.id);
            logger.info('Link created:', {
                id: link.id,
                url: link.url,
                is_rss: link.is_rss,
                rss_url: link.rss_url
            });

            res.status(201).json(link);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /links:
     *   get:
     *     summary: Get all links
     *     description: Retrieves all links with pagination support
     *     tags: [Links]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number (1-based)
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 9
     *         description: Number of items per page
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [createdAt, updatedAt, title]
     *         description: Field to sort by
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: string
     *           enum: [ASC, DESC]
     *           default: DESC
     *         description: Sort order direction
     *     responses:
     *       200:
     *         description: List of links
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/PaginatedResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         items:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Link'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async index(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const links = await this.linksService.getLinks(req.user!.id);
            res.json(links);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /links/{id}:
     *   patch:
     *     summary: Update a link
     *     description: Updates an existing link by ID
     *     tags: [Links]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Link ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: Link name
     *               url:
     *                 type: string
     *                 description: Link URL
     *               rss_url:
     *                 type: string
     *                 description: RSS feed URL
     *               is_rss:
     *                 type: boolean
     *                 description: Whether this is an RSS feed
     *     responses:
     *       200:
     *         description: Link updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Link'
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Link not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async update(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const data: UpdateLinkDto = req.body;
            const link = await this.linksService.updateLink(id, data, req.user!.id);

            logger.info('Link updated:', { id: link.id, url: link.url });
            res.json(link);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /links/{id}:
     *   delete:
     *     summary: Delete a link
     *     description: Deletes a link and all associated posts
     *     tags: [Links]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Link ID
     *     responses:
     *       204:
     *         description: Link deleted successfully
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Link not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async destroy(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            await this.linksService.deleteLink(id, req.user!.id);

            logger.info('Link deleted:', { id });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /links/{id}/fetch-posts:
     *   post:
     *     summary: Fetch posts for a specific link
     *     description: Fetches new posts from the RSS feed associated with the link
     *     tags: [Links]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Link ID
     *     responses:
     *       200:
     *         description: Posts fetched successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 link:
     *                   $ref: '#/components/schemas/Link'
     *                 insertedCount:
     *                   type: integer
     *                   description: Number of new posts inserted during this fetch
     *               required:
     *                 - link
     *                 - insertedCount
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Link not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Failed to fetch posts
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async fetchPosts(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const {link, insertedCount} = await this.linksService.fetchPosts(id, req.user!.id);

            logger.info('Posts fetched for link:', { id: link.id, url: link.url });
            res.json({
                link,
                insertedCount,
            });
        } catch (error) {
            next(error);
        }
    }
}