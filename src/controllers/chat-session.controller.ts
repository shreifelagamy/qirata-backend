import { NextFunction, Request, Response } from 'express';
import { CreateChatSessionDto } from '../dtos/chat-session.dto';
import { SendMessageDto, StreamMessageDto } from '../dtos/ai-chat.dto';
import { ChatSessionService } from '../services/chat-session.service';
import { SocialPostsService } from '../services/social-posts.service';
import { AIStreamCallback } from '../types/ai.types';
import { logger } from '../utils/logger';
import { MessagesService } from '../services/messages.service';

export class ChatSessionController {
    // The service is initialized in the constructor, so we don't need to assign it here.
    private service: ChatSessionService;
    private socialPostsService: SocialPostsService;
    private messageService: MessagesService;

    constructor() {
        this.service = new ChatSessionService();
        this.messageService = new MessagesService();
        this.socialPostsService = new SocialPostsService();
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
    async show(req: Request, res: Response, next: NextFunction) {
        try {
            const session = await this.service.findOne(req.params.id);
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

            const result = await this.messageService.getMessages(sessionId, page, pageSize);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}/social-posts:
     *   get:
     *     summary: Get social posts for a chat session
     *     description: Retrieves all social posts generated in a chat session
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
     *         description: List of social posts
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/SocialPost'
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
    async getSocialPosts(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.id;
            const posts = await this.socialPostsService.findByChatSession(sessionId);
            res.json({ data: posts, status: 200 });
        } catch (err) {
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}/social-posts/{postId}:
     *   put:
     *     summary: Update a social post
     *     description: Updates the content of an existing social post in a chat session
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
     *       - in: path
     *         name: postId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Social post ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - content
     *             properties:
     *               content:
     *                 type: string
     *                 description: The updated social post content
     *               image_urls:
     *                 type: array
     *                 items:
     *                   type: string
     *                   format: url
     *                 description: Array of image URLs
     *               code_examples:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     language:
     *                       type: string
     *                       description: Programming language
     *                     code:
     *                       type: string
     *                       description: Code snippet
     *                     description:
     *                       type: string
     *                       description: Optional description of the code
     *                 description: Array of code examples
     *               visual_elements:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     type:
     *                       type: string
     *                       description: Type of visual element
     *                     description:
     *                       type: string
     *                       description: Description of the visual element
     *                     suggestion:
     *                       type: string
     *                       description: Optional suggestion for the visual element
     *                 description: Array of visual elements
     *     responses:
     *       200:
     *         description: Social post updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/SocialPost'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Social post not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async updateSocialPost(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.id;
            const postId = req.params.postId;
            const { content, image_urls, code_examples, visual_elements } = req.body;

            const updatedPost = await this.socialPostsService.update(sessionId, postId, {
                content,
                image_urls,
                code_examples,
                visual_elements
            });

            res.json({ data: updatedPost, status: 200 });
        } catch (err) {
            if (err instanceof Error && err.message === 'Social post not found') {
                return res.status(404).json({ error: { code: '404', message: err.message } });
            }
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{id}/social-posts/{postId}:
     *   delete:
     *     summary: Delete a social post
     *     description: Deletes a social post from a chat session
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
     *       - in: path
     *         name: postId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Social post ID
     *     responses:
     *       204:
     *         description: Social post deleted successfully
     *       404:
     *         description: Social post not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async deleteSocialPost(req: Request, res: Response, next: NextFunction) {
        try {
            const postId = req.params.postId;

            await this.socialPostsService.delete(postId);
            res.status(204).send();
        } catch (err) {
            if (err instanceof Error && err.message === 'Social post not found') {
                return res.status(404).json({ error: { code: '404', message: err.message } });
            }
            next(err);
        }
    }
}
