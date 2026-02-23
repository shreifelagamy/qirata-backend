import { NextFunction, Request, Response } from 'express';
import { CreateChatSessionDto } from '../dtos/chat-session.dto';
import { ChatSessionService } from '../services/domain';

export class ChatSessionController {
    private service: ChatSessionService;

    constructor() {
        this.service = new ChatSessionService();
    }

    /**
     * @swagger
     * /chat-sessions:
     *   get:
     *     summary: Get all chat sessions
     *     description: Retrieves a list of chat sessions with pagination
     *     tags: [Chat Sessions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: query
     *         schema:
     *           type: string
     *         description: Search query to filter chat sessions by title or related post title
     *       - in: query
     *         name: favorite_filter
     *         schema:
     *           type: string
     *           enum: [all, favorites, regular]
     *           default: all
     *         description: Filter chat sessions by favorite status
     *     responses:
     *       200:
     *         description: List of chat sessions
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
     *                         $ref: '#/components/schemas/ChatSession'
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
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async index(req: Request, res: Response, next: NextFunction) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;
            const query = req.query.query as string | undefined;
            const favoriteFilter = req.query.favorite_filter as 'all' | 'favorites' | 'regular' | undefined;

            const result = await this.service.find(req.user!.id, page, pageSize, query, favoriteFilter);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}:
     *   get:
     *     summary: Get a chat session by ID
     *     description: Retrieves a specific chat session's basic details (without related post data)
     *     tags: [Chat Sessions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Chat session ID
     *     responses:
     *       200:
     *         description: Chat session basic details (without post relation)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   description: Chat session without related post data
     *                   properties:
     *                     id:
     *                       type: string
     *                       format: uuid
     *                       description: Unique identifier for the chat session
     *                     title:
     *                       type: string
     *                       description: Chat session title
     *                     post_id:
     *                       type: string
     *                       format: uuid
     *                       nullable: true
     *                       description: Associated post ID
     *                     summary:
     *                       type: string
     *                       nullable: true
     *                       description: AI-generated summary of the chat session
     *                     last_summary_at:
     *                       type: string
     *                       format: date-time
     *                       nullable: true
     *                       description: Timestamp when the summary was last updated
     *                     is_favorite:
     *                       type: boolean
     *                       description: Whether the chat session is marked as favorite
     *                       default: false
     *                     created_at:
     *                       type: string
     *                       format: date-time
     *                       description: When the chat session was created
     *                 status:
     *                   type: integer
     *                   example: 200
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Chat session not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async show(req: Request, res: Response, next: NextFunction) {
        try {
            const session = await this.service.getById(req.params.id, req.user!.id);
            if (!session) return res.status(404).json({ error: { code: '404', message: 'Chat session not found' } });
            res.json({ data: session, status: 200 });
        } catch (err) {
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions:
     *   post:
     *     summary: Create a new chat session
     *     description: Creates a new chat session, optionally associated with a post
     *     tags: [Chat Sessions]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateChatSessionDto'
     *           example:
     *             title: "Discussion about AI trends"
     *             postId: "550e8400-e29b-41d4-a716-446655440000"
     *     responses:
     *       201:
     *         description: Chat session created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChatSession'
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
     *         description: Post not found (when postId is provided)
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async store(req: Request, res: Response, next: NextFunction) {
        try {
            const dto = Object.assign(new CreateChatSessionDto(), req.body);
            const session = await this.service.create(dto, req.user!.id);
            res.status(201).json(session);
        } catch (err) {
            if (err instanceof Error && err.message === 'Post not found') return res.status(404).json({ error: { code: '404', message: 'Post not found' } });
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}/favorite:
     *   patch:
     *     summary: Toggle favorite status of a chat session
     *     description: Toggles the favorite status of a chat session between true and false
     *     tags: [Chat Sessions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Chat session ID
     *     responses:
     *       200:
     *         description: Favorite status toggled successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/ChatSession'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Chat session not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async toggleFavorite(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.id;
            const session = await this.service.toggleFavorite(sessionId, req.user!.id);
            if (!session) {
                return res.status(404).json({
                    error: {
                        code: '404',
                        message: 'Chat session not found'
                    }
                });
            }
            res.json({ data: session, status: 200 });
        } catch (err) {
            next(err);
        }
    }
}
