import { NextFunction, Request, Response } from 'express';
import { SocialPostsService } from '../services/social-posts.service';

export class SocialPostsController {
    private socialPostsService: SocialPostsService;

    constructor() {
        this.socialPostsService = new SocialPostsService();
    }

    /**
     * @swagger
     * /chat-sessions/{sessionId}/social-posts:
     *   get:
     *     summary: Get social posts for a chat session
     *     description: Retrieves all social posts generated in a chat session
     *     tags: [Social Posts]
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
    async index(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.sessionId;
            const posts = await this.socialPostsService.findByChatSession(sessionId, req.user!.id);
            res.json({ data: posts, status: 200 });
        } catch (err) {
            next(err);
        }
    }

    /**
     * @swagger
     * /chat-sessions/{sessionId}/social-posts/{postId}:
     *   put:
     *     summary: Update a social post
     *     description: Updates the content of an existing social post in a chat session
     *     tags: [Social Posts]
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
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.sessionId;
            const postId = req.params.postId;
            const { content, image_urls, code_examples, visual_elements } = req.body;

            const updatedPost = await this.socialPostsService.update(sessionId, postId, req.user!.id, {
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
     * /chat-sessions/{sessionId}/social-posts/{postId}:
     *   delete:
     *     summary: Delete a social post
     *     description: Deletes a social post from a chat session
     *     tags: [Social Posts]
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
    async destroy(req: Request, res: Response, next: NextFunction) {
        try {
            const postId = req.params.postId;

            await this.socialPostsService.delete(postId, req.user!.id);
            res.status(204).send();
        } catch (err) {
            if (err instanceof Error && err.message === 'Social post not found') {
                return res.status(404).json({ error: { code: '404', message: err.message } });
            }
            next(err);
        }
    }
}
