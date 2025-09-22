import { NextFunction, Request, Response } from 'express';
import { CreateLinkDto } from '../dtos/link.dto';
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
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/Link'
     *                 status:
     *                   type: integer
     *                   example: 201
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
     *               invalid_rss_url:
     *                 summary: Invalid RSS URL format
     *                 value:
     *                   message: "Invalid RSS URL format. Please provide a valid URL."
     *               link_no_rss_feed:
     *                 summary: Link has no RSS feed
     *                 value:
     *                   message: "Link does not have an RSS feed configured"
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               no_token:
     *                 summary: No authentication token provided
     *                 value:
     *                   message: "Authentication token required"
     *                   status: 401
     *               invalid_token:
     *                 summary: Invalid authentication token
     *                 value:
     *                   message: "Invalid or expired authentication token"
     *                   status: 401
     *       409:
     *         description: Conflict - Duplicate URL
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               duplicate_url:
     *                 summary: URL already exists
     *                 value:
     *                   message: "A link with this URL already exists"
     *       422:
     *         description: Unprocessable Entity - Invalid RSS content
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               invalid_rss_structure:
     *                 summary: RSS feed has invalid structure
     *                 value:
     *                   message: "The RSS feed exists but has an invalid structure or is missing required content."
     *               empty_rss_feed:
     *                 summary: RSS feed contains no articles
     *                 value:
     *                   message: "The RSS feed is valid but contains no articles. Please ensure the feed has published content."
     *               invalid_rss_content:
     *                 summary: RSS articles missing required information
     *                 value:
     *                   message: "The RSS feed exists but the articles are missing required information (title, link, or content)."
     *               not_rss_content:
     *                 summary: URL does not contain RSS content
     *                 value:
     *                   message: "The URL does not contain valid RSS content. Please provide a direct link to an RSS feed."
     *               no_valid_feeds:
     *                 summary: No valid RSS feeds found
     *                 value:
     *                   message: "Found RSS feed links, but none contain valid RSS content with articles."
     *       503:
     *         description: Service Unavailable - Network or access issues
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               network_error:
     *                 summary: Unable to access URL
     *                 value:
     *                   message: "Unable to access the URL. Please check the URL and try again."
     *               rss_access_error:
     *                 summary: Unable to access RSS feed
     *                 value:
     *                   message: "Unable to access the RSS feed. Please check the URL and try again."
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

            res.status(201).json({ data: link, status: 201 });
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
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Link'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               no_token:
     *                 summary: No authentication token provided
     *                 value:
     *                   message: "Authentication token required"
     *                   status: 401
     *               invalid_token:
     *                 summary: Invalid authentication token
     *                 value:
     *                   message: "Invalid or expired authentication token"
     *                   status: 401
     *       403:
     *         description: Forbidden - Access denied
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               access_denied:
     *                 summary: Access denied to user links
     *                 value:
     *                   message: "Access denied to user links"
     *       500:
     *         description: Failed to get links
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
            res.json({ data: links, status: 200 });
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
     *       400:
     *         description: Bad request - Invalid link ID format
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               invalid_id:
     *                 summary: Invalid link ID format
     *                 value:
     *                   message: "Invalid link ID format"
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               no_token:
     *                 summary: No authentication token provided
     *                 value:
     *                   message: "Authentication token required"
     *                   status: 401
     *               invalid_token:
     *                 summary: Invalid authentication token
     *                 value:
     *                   message: "Invalid or expired authentication token"
     *                   status: 401
     *       404:
     *         description: Link not found or access denied
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               link_not_found:
     *                 summary: Link not found
     *                 value:
     *                   message: "Link not found or access denied"
     *       409:
     *         description: Conflict - Cannot delete due to dependencies
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               has_dependencies:
     *                 summary: Link has associated data
     *                 value:
     *                   message: "Cannot delete link. It has associated data that must be removed first."
     *       500:
     *         description: Failed to delete link
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
     *                 data:
     *                   type: object
     *                   properties:
     *                     link:
     *                       $ref: '#/components/schemas/Link'
     *                     insertedCount:
     *                       type: integer
     *                       description: Number of new posts inserted during this fetch
     *                   required:
     *                     - link
     *                     - insertedCount
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request - Invalid link ID or link configuration
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               invalid_id:
     *                 summary: Invalid link ID format
     *                 value:
     *                   message: "Invalid link ID format"
     *               no_rss_feed:
     *                 summary: Link has no RSS feed
     *                 value:
     *                   message: "Link does not have an RSS feed configured"
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               no_token:
     *                 summary: No authentication token provided
     *                 value:
     *                   message: "Authentication token required"
     *                   status: 401
     *               invalid_token:
     *                 summary: Invalid authentication token
     *                 value:
     *                   message: "Invalid or expired authentication token"
     *                   status: 401
     *       404:
     *         description: Link not found or access denied
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               link_not_found:
     *                 summary: Link not found
     *                 value:
     *                   message: "Link not found or access denied"
     *       422:
     *         description: Unprocessable Entity - RSS feed issues
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               invalid_rss_feed:
     *                 summary: Unable to parse RSS feed
     *                 value:
     *                   message: "Unable to parse RSS feed. The feed may be invalid or corrupted."
     *       500:
     *         description: Failed to fetch posts
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       503:
     *         description: Service Unavailable - Unable to access RSS feed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *             examples:
     *               rss_access_error:
     *                 summary: Unable to access RSS feed
     *                 value:
     *                   message: "Unable to access RSS feed. Please try again later."
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
                data: {
                    link,
                    insertedCount,
                },
                status: 200
            });
        } catch (error) {
            next(error);
        }
    }
}