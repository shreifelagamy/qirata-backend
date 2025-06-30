import { NextFunction, Request, Response } from 'express';
import { CreateChatSessionDto } from '../dtos/chat-session.dto';
import { SendMessageDto, StreamMessageDto } from '../dtos/ai-chat.dto';
import { ChatSessionService } from '../services/chat-session.service';
import { AIStreamCallback } from '../types/ai.types';
import { logger } from '../utils/logger';

export class ChatSessionController {
    // The service is initialized in the constructor, so we don't need to assign it here.
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

            const result = await this.service.findAll(page, pageSize);
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
     *     description: Retrieves a specific chat session with its details
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
     *         description: Chat session details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChatSession'
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
            const session = await this.service.findOne(req.params.id);
            if (!session) return res.status(404).json({ error: { code: '404', message: 'Chat session not found' } });
            res.json(session);
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
            const session = await this.service.create(dto);
            res.status(201).json(session);
        } catch (err) {
            if (err instanceof Error && err.message === 'Post not found') return res.status(404).json({ error: { code: '404', message: 'Post not found' } });
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}/messages:
     *   get:
     *     summary: Get messages for a chat session
     *     description: Retrieves all messages in a chat session with pagination
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
     *           default: 20
     *         description: Number of messages per page
     *     responses:
     *       200:
     *         description: List of messages
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
     *                         $ref: '#/components/schemas/Message'
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
     *       404:
     *         description: Chat session not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async getMessages(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.id;
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;

            const result = await this.service.getMessages(sessionId, page, pageSize);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    
}
