import { NextFunction, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { logger } from '../utils/logger';

export class SettingsController {
    private settingsService: SettingsService;

    constructor() {
        this.settingsService = new SettingsService();
    }

    /**
     * @swagger
     * /settings:
     *   get:
     *     summary: Get all settings
     *     description: Retrieves all settings
     *     tags: [Settings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Settings retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Settings'
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
            const settings = await this.settingsService.list(req.user!.id);
            res.json({ data: settings, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /settings/{key}:
     *   get:
     *     summary: Get a setting by key
     *     description: Retrieves a specific setting value by its key
     *     tags: [Settings]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: key
     *         required: true
     *         schema:
     *           type: string
     *         description: Setting key to retrieve
     *         example: "theme"
     *     responses:
     *       200:
     *         description: Setting retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Settings'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Setting not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async show(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const key = req.params.key;
            const setting = await this.settingsService.show(key, req.user!.id);

            res.json({ data: setting, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /settings/{key}:
     *   patch:
     *     summary: Update a setting
     *     description: Updates the value of a specific setting by its key
     *     tags: [Settings]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: key
     *         required: true
     *         schema:
     *           type: string
     *         description: Setting key to update
     *         example: "theme"
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateSettingsDto'
     *           example:
     *             value: "dark"
     *     responses:
     *       200:
     *         description: Setting updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Settings'
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
     *         description: Setting not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async upsert(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const key = req.params.key;
            const { value, description } = req.body;

            const setting = await this.settingsService.upsert(key, value, req.user!.id, description);

            logger.info('Setting upserted:', { key, value });
            res.json({ data: setting, status: 200 });
        } catch (error) {
            next(error);
        }
    }
}