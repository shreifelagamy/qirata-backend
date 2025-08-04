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
            const post = await this.postsService.createPost(data);

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
     *       - in: query
     *         name: link_id
     *         schema:
     *           type: string
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
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
     *                         $ref: '#/components/schemas/Post'
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
                read: req.query.read === 'true',
                link_id: req.query.link_id as string,
                search: req.query.search as string,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as 'ASC' | 'DESC'
            };

            const [posts, total] = await this.postsService.getPosts(filters);
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
            const post = await this.postsService.getPost(id);

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

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Headers': 'Cache-Control, Accept, Accept-Language, DNT, Origin, Referer, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, User-Agent, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Credentials': 'true'
            });

            // Progress callback for streaming updates
            const progressCallback = (step: string, progress: number) => {
                res.write(`event: progress\n`);
                res.write(`data: ${JSON.stringify({ step, progress })}\n\n`);
            };

            // Start expansion with streaming
            const expanded = await this.postsService.expandPost(id, progressCallback);

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
            const post = await this.postsService.updatePost(id, data);

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
            await this.postsService.deletePost(id);

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
            const post = await this.postsService.markAsRead(id);

            logger.info('Post marked as read:', { id: post.id });
            res.json(post);
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
            const expanded = await this.postsService.getExpanded(id);

            res.json(expanded);
        } catch (error) {
            next(error);
        }
    }
}