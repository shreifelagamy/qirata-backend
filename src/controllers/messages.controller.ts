import { NextFunction, Request, Response } from 'express';
import { MessagesService } from '../services/domain';

export class MessagesController {
    private messagesService: MessagesService;

    constructor() {
        this.messagesService = new MessagesService();
    }

    /**
     * @swagger
     * /chat-sessions/{sessionId}/messages:
     *   get:
     *     summary: Get messages for a chat session
     *     description: Retrieves messages in reverse chronological order (newest first) with cursor-based pagination for infinite scroll
     *     tags: [Messages]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Chat session ID
     *       - in: query
     *         name: cursor
     *         schema:
     *           type: string
     *           format: date-time
     *         description: Cursor timestamp to load messages before this time (for pagination)
     *         example: "2024-01-15T10:30:00.000Z"
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 50
     *           default: 20
     *         description: Maximum number of messages to return
     *     responses:
     *       200:
     *         description: List of messages in reverse chronological order
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
     *                       description: Messages ordered by creation date (newest first)
     *                     total:
     *                       type: integer
     *                       description: Total number of messages in the session
     *                     hasMore:
     *                       type: boolean
     *                       description: Whether more messages are available for pagination
     *                     nextCursor:
     *                       type: string
     *                       format: date-time
     *                       nullable: true
     *                       description: Cursor for the next page of results (null if no more messages)
     *                       example: "2024-01-15T09:45:00.000Z"
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request (invalid cursor format)
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
     *         description: Chat session not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async index(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.sessionId;
            const cursor = req.query.cursor as string | undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

            const result = await this.messagesService.getMessages(sessionId, req.user!.id, cursor, limit);
            res.json(result);
        } catch (err) {
            if (err instanceof Error && err.message === 'Invalid cursor format') {
                return res.status(400).json({
                    error: {
                        code: '400',
                        message: 'Invalid cursor format. Expected ISO timestamp.'
                    }
                });
            }
            next(err);
        }
    }
}
