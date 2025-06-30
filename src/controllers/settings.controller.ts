import { NextFunction, Request, Response } from 'express';
import { UpdateSettingsDto } from '../dtos/settings.dto';
import { SettingsService } from '../services/settings.service';
import { logger } from '../utils/logger';

export class SettingsController {
    private settingsService: SettingsService;

    constructor() {
        this.settingsService = new SettingsService();
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
            const setting = await this.settingsService.getSetting(key);

            res.json(setting);
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
    async update(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const key = req.params.key;
            const data: UpdateSettingsDto = req.body;
            const setting = await this.settingsService.updateSetting(key, data);

            logger.info('Setting updated:', { key, value: data.value });
            res.json(setting);
        } catch (error) {
            next(error);
        }
    }
}