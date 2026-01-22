import { NextFunction, Request, Response } from 'express';
import { PostsService } from '../services/posts.service';
import { logger } from '../utils/logger';
import { SSEResponse } from '../utils/sse';

export class PostsController {
    private postsService: PostsService;

    constructor() {
        this.postsService = new PostsService();
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
    async index(req: Request, res: Response, next: NextFunction) {
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
     * /posts/{id}/discuss:
     *   get:
     *     summary: Start AI discussion for a post with streaming preparation progress
     *     description: |
     *       Creates/retrieves chat session immediately, then prepares AI-ready content in background.
     *       Streams progress updates via Server-Sent Events:
     *       - session event (early): Contains chat_session_id for immediate navigation
     *       - progress events: Stateful progress with state machine (deciding_content, scraping_main, following_read_more, optimizing_for_ai, summarizing, saving_expanded)
     *       - ready event (final): Content preparation complete
     *       - error event: On failure
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
     *               description: Server-Sent Events stream with session, progress, and ready events
     *               example: |
     *                 event: session
     *                 data: {"chat_session_id": "uuid", "post_id": "uuid", "state": "session_ready"}
     *
     *                 event: progress
     *                 data: {"state": "scraping_main", "step": "Extracting main content...", "progress": 20}
     *
     *                 event: progress
     *                 data: {"state": "following_read_more", "step": "Following read more links...", "progress": 40, "meta": {"current": 1, "total": 3}}
     *
     *                 event: ready
     *                 data: {"chat_session_id": "uuid", "post_id": "uuid", "state": "ready"}
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Post not found
     *       500:
     *         description: Failed to prepare post content
     */
    async discuss(req: Request, res: Response, next: NextFunction) {
        const id = req.params.id;

        if (!req.user?.id) {
            res.writeHead(401, { 'Content-Type': 'text/event-stream' });
            res.write(`event: error\ndata: ${JSON.stringify({ error: 'UNAUTHORIZED' })}\n\n`);
            res.end();
            return;
        }

        const sse = new SSEResponse(res, req);

        try {
            const generator = this.postsService.prepareForDiscussion(id, req.user.id);
            let result: { chat_session_id: string } | undefined;

            while (true) {
                const { value, done } = await generator.next();

                if (done) {
                    result = value;
                    break;
                }

                const event = value;
                if (event.state === 'session_ready') {
                    sse.send('session', {
                        chat_session_id: event.meta?.chat_session_id,
                        post_id: id,
                        state: 'session_ready'
                    });
                } else {
                    sse.send('progress', {
                        state: event.state,
                        step: event.step,
                        progress: event.progress,
                        ...(event.meta && { meta: event.meta })
                    });
                }
            }

            if (result) {
                sse.send('ready', {
                    chat_session_id: result.chat_session_id,
                    post_id: id,
                    state: 'ready'
                });
            }

            sse.end();
        } catch (error) {
            sse.sendError(error instanceof Error ? error.message : 'Failed to prepare post for discussion');
        }
    }

    /**
     * @swagger
     * /posts/{id}/read:
     *   patch:
     *     summary: Mark a post as read (only once)
     *     description: Marks a post as read for the current user. If the post is already marked as read, no action is taken.
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
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     success:
     *                       type: boolean
     *                       example: true
     *                 status:
     *                   type: integer
     *                   example: 200
     *       404:
     *         description: Post not found
     */
    async read(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            await this.postsService.markAsRead(id, req.user!.id);

            logger.info('Post marked as read:', { id });
            res.json({
                data: { success: true },
                status: 200
            });
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
    async bookmark(req: Request, res: Response, next: NextFunction) {
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
}