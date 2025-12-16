import { NextFunction, Request, Response } from 'express';
import { CreatePostDto, UpdatePostDto } from '../dtos/post.dto';
import { PostsService } from '../services/posts.service';
import { logger } from '../utils/logger';

export class PostsController {
    private postsService: PostsService;

    constructor() {
        this.postsService = new PostsService();
    }

    /**
     * @swagger
     * /posts:
     *   post:
     *     summary: Create a new post
     *     tags: [Posts]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreatePostDto'
     *     responses:
     *       201:
     *         description: Post created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Post'
     */
    async store(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const data: CreatePostDto = req.body;
            const post = await this.postsService.createPost(data, req.user!.id);

            logger.info('Post created:', { id: post.id, title: post.title });
            res.status(201).json(post);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts:
     *   get:
     *     summary: Get all posts with pagination and filters
     *     description: Returns posts ordered by sequence (newest first) using incremental ID for consistent ordering
     *     tags: [Posts]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 9
     *       - in: query
     *         name: read
     *         schema:
     *           type: boolean
     *         description: Filter posts by read status - true for read posts, false for unread posts, omit for all posts
     *       - in: query
     *         name: link_id
     *         schema:
     *           type: string
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: feed_id
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Filter posts by feed ID
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [added_date, published_date]
     *           default: added_date
     *         description: Sort posts by added date (sequence) or published date
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: string
     *           enum: [ASC, DESC]
     *           default: DESC
     *         description: Sort order - ascending or descending
     *     responses:
     *       200:
     *         description: Success
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
     *                         $ref: '#/components/schemas/PostSummary'
     *                     total:
     *                       type: integer
     *                     page:
     *                       type: integer
     *                     pageSize:
     *                       type: integer
     *                     totalPages:
     *                       type: integer
     */
    async index(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 9;

            const filters = {
                read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
                link_id: req.query.link_id as string,
                search: req.query.search as string,
                feed_id: req.query.feed_id as string,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as 'ASC' | 'DESC'
            };

            const [posts, total] = await this.postsService.getPosts(filters, req.user!.id);
            const totalPages = Math.ceil(total / pageSize);

            res.json({
                data: {
                    items: posts,
                    total,
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
     * /posts/{id}:
     *   get:
     *     summary: Get a post by ID
     *     tags: [Posts]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     responses:
     *       200:
     *         description: Success
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Post'
     *       404:
     *         description: Post not found
     */
    async show(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const post = await this.postsService.getPost(id, req.user!.id);

            res.json(post);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts/{id}/expand:
     *   get:
     *     summary: Expand a post and get chat session with streaming progress
     *     description: Creates or retrieves chat session for the post, expands content using AgentQL with parallel read-more link processing, and streams progress updates via Server-Sent Events
     *     tags: [Posts]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Post ID
     *     responses:
     *       200:
     *         description: Streaming response with progress updates
     *         content:
     *           text/event-stream:
     *             schema:
     *               type: string
     *               description: Server-Sent Events stream with progress updates and final result
     *               example: |
     *                 event: progress
     *                 data: {"step": "Extracting main content...", "progress": 10}
     *
     *                 event: progress
     *                 data: {"step": "Following read more links (1/3)...", "progress": 40}
     *
     *                 event: complete
     *                 data: {"id": "123", "title": "Post Title", "chat_session_id": "456"}
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Post not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       500:
     *         description: Failed to expand post content
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async expand(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;

            // Auth middleware has already validated the session and populated req.user
            // If we reach this point, the user is authenticated
            if (!req.user?.id) {
                res.writeHead(401, { 'Content-Type': 'text/event-stream' });
                res.write(`event: error\n`);
                res.write(`data: ${JSON.stringify({ error: 'UNAUTHORIZED' })}\n\n`);
                res.end();
                return;
            }

            // Set up SSE headers (CORS headers handled by middleware)
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            // Progress callback for streaming updates
            const progressCallback = (step: string, progress: number) => {
                res.write(`event: progress\n`);
                res.write(`data: ${JSON.stringify({ step, progress })}\n\n`);
            };

            // Start expansion with streaming
            const expanded = await this.postsService.expandPost(id, req.user!.id, progressCallback);

            // Send final result
            res.write(`event: complete\n`);
            res.write(`data: ${JSON.stringify(expanded)}\n\n`);
            res.end();
        } catch (error) {
            // Send error via SSE
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to expand post'
            })}\n\n`);
            res.end();
        }
    }

    /**
     * @swagger
     * /posts/{id}:
     *   patch:
     *     summary: Update a post
     *     tags: [Posts]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdatePostDto'
     *     responses:
     *       200:
     *         description: Success
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Post'
     *       404:
     *         description: Post not found
     */
    async update(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const data: UpdatePostDto = req.body;
            const post = await this.postsService.updatePost(id, data, req.user!.id);

            logger.info('Post updated:', { id: post.id, title: post.title });
            res.json(post);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts/{id}:
     *   delete:
     *     summary: Delete a post
     *     description: Permanently deletes a post and all associated data
     *     tags: [Posts]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Post ID
     *     responses:
     *       204:
     *         description: Post deleted successfully
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Post not found
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
            await this.postsService.deletePost(id, req.user!.id);

            logger.info('Post deleted:', { id });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts/{id}/read:
     *   patch:
     *     summary: Mark a post as read
     *     tags: [Posts]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     responses:
     *       200:
     *         description: Success
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Post'
     *       404:
     *         description: Post not found
     */
    async read(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const post = await this.postsService.markAsRead(id, req.user!.id);

            logger.info('Post marked as read:', { id: post.id });
            res.json(post);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts/{id}/bookmark:
     *   patch:
     *     summary: Toggle bookmark status for a post
     *     description: Toggles bookmark status on/off for the post. Creates user_post entry if it doesn't exist.
     *     tags: [Posts]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Post ID
     *     responses:
     *       200:
     *         description: Bookmark toggled successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     post:
     *                       $ref: '#/components/schemas/Post'
     *                     bookmarked:
     *                       type: boolean
     *                       description: New bookmark status
     *                 status:
     *                   type: integer
     *                   example: 200
     *       404:
     *         description: Post not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async bookmark(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const result = await this.postsService.toggleBookmark(id, req.user!.id);

            logger.info('Post bookmark toggled:', { id, bookmarked: result.bookmarked });
            res.json({
                data: result,
                status: 200
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /posts/{id}/expanded:
     *   get:
     *     summary: Get saved expanded content for a post
     *     tags: [Posts]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     responses:
     *       200:
     *         description: Success
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PostExpanded'
     *       404:
     *         description: Post not found or not expanded
     */
    async expanded(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const id = req.params.id;
            const expanded = await this.postsService.getExpanded(id, req.user!.id);

            res.json(expanded);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DEPRECATED: This endpoint has been deprecated in favor of feed subscriptions
     * Use GET /api/v1/feeds/subscriptions instead
     *
     * @swagger
     * /posts/sources:
     *   get:
     *     deprecated: true
     *     summary: Get unique sources list (DEPRECATED)
     *     description: Returns all unique RSS sources that have posts in the database with optional post counts. DEPRECATED - Use /api/v1/feeds/subscriptions instead.
     *     tags: [Posts]
     *     parameters:
     *       - in: query
     *         name: includeCount
     *         schema:
     *           type: boolean
     *           default: false
     *         description: Include post count for each source
     *     responses:
     *       200:
     *         description: Success
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     oneOf:
     *                       - type: string
     *                         description: Source name (when includeCount=false)
     *                       - type: object
     *                         properties:
     *                           source:
     *                             type: string
     *                           count:
     *                             type: integer
     *                         description: Source with post count (when includeCount=true)
     *                 status:
     *                   type: integer
     */
    // async sources(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ) {
    //     try {
    //         const includeCount = req.query.includeCount === 'true';
    //         const sources = await this.postsService.getSources(includeCount, req.user!.id);

    //         res.json({
    //             data: sources,
    //             status: 200
    //         });
    //     } catch (error) {
    //         next(error);
    //     }
    // }
}