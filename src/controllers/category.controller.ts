import { NextFunction, Request, Response } from 'express';
import { CategoryService, CreateCategoryDto, UpdateCategoryDto } from '../services/category.service';
import { logger } from '../utils/logger';

export class CategoryController {
    private categoryService: CategoryService;

    constructor() {
        this.categoryService = new CategoryService();
    }

    /**
     * @swagger
     * /categories:
     *   post:
     *     summary: Create a new category
     *     description: Creates a new category/folder for organizing feeds
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Tech Blogs"
     *                 maxLength: 100
     *               parent_id:
     *                 type: string
     *                 format: uuid
     *                 description: Parent category ID for nested folders
     *                 nullable: true
     *     responses:
     *       201:
     *         description: Category created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/Category'
     *                 status:
     *                   type: integer
     *                   example: 201
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Parent category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       409:
     *         description: Category with this name already exists
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const data: CreateCategoryDto = req.body;
            const category = await this.categoryService.createCategory(data, req.user!.id);

            logger.info('Category created:', { id: category.id, name: category.name });
            res.status(201).json({ data: category, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories:
     *   get:
     *     summary: Get all categories
     *     description: Retrieves all user categories in a nested tree structure
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of categories
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Category'
     *                 status:
     *                   type: integer
     *                   example: 200
     */
    async index(req: Request, res: Response, next: NextFunction) {
        try {
            const categories = await this.categoryService.getUserCategories(req.user!.id);
            res.json({ data: categories, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories/{id}:
     *   get:
     *     summary: Get a specific category
     *     description: Retrieves a category by ID with its feeds and children
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Category ID
     *     responses:
     *       200:
     *         description: Category details
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/Category'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async show(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await this.categoryService.getCategory(req.params.id, req.user!.id);
            res.json({ data: category, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories/{id}:
     *   put:
     *     summary: Update a category
     *     description: Updates category name or moves it to a different parent
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Category ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Updated Tech Blogs"
     *                 maxLength: 100
     *               parent_id:
     *                 type: string
     *                 format: uuid
     *                 nullable: true
     *                 description: New parent category ID (null for root level)
     *     responses:
     *       200:
     *         description: Category updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   $ref: '#/components/schemas/Category'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       400:
     *         description: Bad request - Cannot create circular reference or set self as parent
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       404:
     *         description: Category or parent category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       409:
     *         description: Category with this name already exists at this level
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const data: UpdateCategoryDto = req.body;
            const category = await this.categoryService.updateCategory(
                req.params.id,
                data,
                req.user!.id
            );

            logger.info('Category updated:', { id: category.id, name: category.name });
            res.json({ data: category, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories/{id}:
     *   delete:
     *     summary: Delete a category
     *     description: Deletes a category. Feeds in this category will be moved to uncategorized.
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Category ID
     *       - in: query
     *         name: recursive
     *         schema:
     *           type: boolean
     *           default: false
     *         description: Delete child categories recursively
     *     responses:
     *       204:
     *         description: Category deleted successfully
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       409:
     *         description: Category has child categories (use recursive=true)
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async destroy(req: Request, res: Response, next: NextFunction) {
        try {
            const recursive = req.query.recursive === 'true';
            await this.categoryService.deleteCategory(req.params.id, req.user!.id, recursive);

            logger.info('Category deleted:', { id: req.params.id, recursive });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories/{id}/feeds:
     *   post:
     *     summary: Move feeds to a category
     *     description: Moves multiple feeds to a specific category
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Category ID (use 'null' or 'uncategorized' for root level)
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - feedIds
     *             properties:
     *               feedIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                   format: uuid
     *                 description: Array of user_feed IDs to move
     *     responses:
     *       200:
     *         description: Feeds moved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     message:
     *                       type: string
     *                       example: "Feeds moved successfully"
     *                     movedCount:
     *                       type: integer
     *                 status:
     *                   type: integer
     *                   example: 200
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async moveFeeds(req: Request, res: Response, next: NextFunction) {
        try {
            const categoryId = req.params.id === 'null' || req.params.id === 'uncategorized'
                ? null
                : req.params.id;
            const { feedIds } = req.body;

            if (!Array.isArray(feedIds)) {
                return res.status(400).json({
                    message: 'feedIds must be an array',
                    status: 400
                });
            }

            await this.categoryService.moveFeedsToCategory(categoryId, feedIds, req.user!.id);

            logger.info('Feeds moved to category:', {
                categoryId,
                feedCount: feedIds.length
            });

            res.json({
                data: {
                    message: 'Feeds moved successfully',
                    movedCount: feedIds.length
                },
                status: 200
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * @swagger
     * /categories/{id}/feeds:
     *   get:
     *     summary: Get feeds in a category
     *     description: Retrieves all feeds in a specific category
     *     tags: [Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Category ID
     *       - in: query
     *         name: recursive
     *         schema:
     *           type: boolean
     *           default: false
     *         description: Include feeds from subcategories
     *     responses:
     *       200:
     *         description: List of feeds in category
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/UserFeed'
     *                 status:
     *                   type: integer
     *                   example: 200
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    async getFeeds(req: Request, res: Response, next: NextFunction) {
        try {
            const recursive = req.query.recursive === 'true';
            const feeds = await this.categoryService.getFeedsInCategory(
                req.params.id,
                req.user!.id,
                recursive
            );

            res.json({ data: feeds, status: 200 });
        } catch (error) {
            next(error);
        }
    }
}
