import { IsNull, Repository } from 'typeorm';
import AppDataSource from '../../config/database.config';
import { Category } from '../../entities/category.entity';
import { UserFeed } from '../../entities/user-feed.entity';
import { HttpError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

export interface CreateCategoryDto {
    name: string;
    parent_id?: string;
}

export interface UpdateCategoryDto {
    name?: string;
    parent_id?: string;
}

/**
 * CategoryService - Manages user feed categories/folders
 *
 * Responsibilities:
 * - CRUD operations for categories
 * - Nested folder support (parent/child relationships)
 * - User-specific category management
 * - Feed organization within categories
 */
export class CategoryService {
    private categoryRepository: Repository<Category>;
    private userFeedRepository: Repository<UserFeed>;

    constructor() {
        this.categoryRepository = AppDataSource.getRepository(Category);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
    }

    /**
     * Create a new category for a user
     * @param data - Category creation data
     * @param userId - The user ID
     * @returns The created category
     */
    async createCategory(data: CreateCategoryDto, userId: string): Promise<Category> {
        try {
            // Validate parent category if provided
            if (data.parent_id) {
                const parent = await this.categoryRepository.findOne({
                    where: { id: data.parent_id, user_id: userId }
                });

                if (!parent) {
                    throw new HttpError(404, 'Parent category not found');
                }
            }

            // Check for duplicate name at the same level
            const existing = await this.categoryRepository.findOne({
                where: {
                    user_id: userId,
                    name: data.name,
                    parent_id: data.parent_id ? data.parent_id : IsNull()
                }
            });

            if (existing) {
                throw new HttpError(409, 'Category with this name already exists at this level');
            }

            const category = this.categoryRepository.create({
                user_id: userId,
                name: data.name,
                parent_id: data.parent_id
            });

            return await this.categoryRepository.save(category);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error creating category:', error);
            throw new HttpError(500, 'Failed to create category');
        }
    }

    /**
     * Get all categories for a user (with nested structure)
     * @param userId - The user ID
     * @returns Array of root categories with nested children
     */
    async getUserCategories(userId: string): Promise<Category[]> {
        try {
            // Get all categories for user
            const allCategories = await this.categoryRepository.find({
                where: { user_id: userId },
                relations: ['children', 'user_feeds'],
                order: { name: 'ASC' }
            });

            // Filter to root categories (those without parents)
            const rootCategories = allCategories.filter(c => !c.parent_id);

            // Recursively build nested structure
            const buildTree = (category: Category): Category => {
                category.children = allCategories
                    .filter(c => c.parent_id === category.id)
                    .map(child => buildTree(child));
                return category;
            };

            return rootCategories.map(buildTree);
        } catch (error) {
            logger.error('Error getting user categories:', error);
            throw new HttpError(500, 'Failed to get categories');
        }
    }

    /**
     * Get a single category by ID
     * @param id - The category ID
     * @param userId - The user ID
     * @returns The category
     */
    async getCategory(id: string, userId: string): Promise<Category> {
        try {
            const category = await this.categoryRepository.findOne({
                where: { id, user_id: userId },
                relations: ['children', 'parent', 'user_feeds']
            });

            if (!category) {
                throw new HttpError(404, 'Category not found');
            }

            return category;
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error(`Error getting category ${id}:`, error);
            throw new HttpError(500, 'Failed to get category');
        }
    }

    /**
     * Update a category
     * @param id - The category ID
     * @param data - Update data
     * @param userId - The user ID
     * @returns The updated category
     */
    async updateCategory(id: string, data: UpdateCategoryDto, userId: string): Promise<Category> {
        try {
            const category = await this.getCategory(id, userId);

            // Validate parent if being updated
            if (data.parent_id !== undefined) {
                // Prevent setting self as parent
                if (data.parent_id === id) {
                    throw new HttpError(400, 'Category cannot be its own parent');
                }

                // Validate parent exists
                if (data.parent_id) {
                    const parent = await this.categoryRepository.findOne({
                        where: { id: data.parent_id, user_id: userId }
                    });

                    if (!parent) {
                        throw new HttpError(404, 'Parent category not found');
                    }

                    // Prevent circular references (parent cannot be a descendant)
                    const isCircular = await this.isDescendant(parent.id, id, userId);
                    if (isCircular) {
                        throw new HttpError(400, 'Cannot create circular category reference');
                    }
                }

                category.parent_id = data.parent_id;
            }

            if (data.name) {
                // Check for duplicate name at the same level
                const existing = await this.categoryRepository.findOne({
                    where: {
                        user_id: userId,
                        name: data.name,
                        parent_id: category.parent_id ? category.parent_id : IsNull()
                    }
                });

                if (existing && existing.id !== id) {
                    throw new HttpError(409, 'Category with this name already exists at this level');
                }

                category.name = data.name;
            }

            return await this.categoryRepository.save(category);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error(`Error updating category ${id}:`, error);
            throw new HttpError(500, 'Failed to update category');
        }
    }

    /**
     * Delete a category
     * @param id - The category ID
     * @param userId - The user ID
     * @param recursive - If true, delete all child categories. If false, fail if has children
     */
    async deleteCategory(id: string, userId: string, recursive: boolean = false): Promise<void> {
        try {
            const category = await this.getCategory(id, userId);

            // Check for children
            if (category.children && category.children.length > 0) {
                if (!recursive) {
                    throw new HttpError(409, 'Category has child categories. Use recursive delete or move children first.');
                }
                // Recursive deletion will be handled by database CASCADE
            }

            // Move feeds in this category to uncategorized (category_id = null)
            if (category.user_feeds && category.user_feeds.length > 0) {
                await this.userFeedRepository
                    .createQueryBuilder()
                    .update(UserFeed)
                    .set({ category_id: () => 'NULL' })
                    .where('category_id = :id', { id })
                    .execute();
            }

            await this.categoryRepository.remove(category);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error(`Error deleting category ${id}:`, error);
            throw new HttpError(500, 'Failed to delete category');
        }
    }

    /**
     * Move feeds to a category
     * @param categoryId - The category ID (null for uncategorized)
     * @param feedIds - Array of user_feed IDs
     * @param userId - The user ID
     */
    async moveFeedsToCategory(categoryId: string | null, feedIds: string[], userId: string): Promise<void> {
        try {
            // Validate category if provided
            if (categoryId) {
                await this.getCategory(categoryId, userId);
            }

            // Update all specified feeds
            for (const feedId of feedIds) {
                const userFeed = await this.userFeedRepository.findOne({
                    where: { id: feedId, user_id: userId }
                });

                if (userFeed) {
                    userFeed.category_id = categoryId ?? undefined;
                    await this.userFeedRepository.save(userFeed);
                }
            }
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error moving feeds to category:', error);
            throw new HttpError(500, 'Failed to move feeds');
        }
    }

    /**
     * Check if categoryA is a descendant of categoryB (for circular reference prevention)
     * @param categoryA - Potential descendant ID
     * @param categoryB - Potential ancestor ID
     * @param userId - The user ID
     * @returns True if categoryA is a descendant of categoryB
     */
    private async isDescendant(categoryA: string, categoryB: string, userId: string): Promise<boolean> {
        try {
            let current = await this.categoryRepository.findOne({
                where: { id: categoryA, user_id: userId }
            });

            while (current && current.parent_id) {
                if (current.parent_id === categoryB) {
                    return true;
                }
                current = await this.categoryRepository.findOne({
                    where: { id: current.parent_id, user_id: userId }
                });
            }

            return false;
        } catch (error) {
            logger.error('Error checking category descendant:', error);
            return false;
        }
    }

    /**
     * Get all feeds in a category (including feeds in subcategories if recursive)
     * @param categoryId - The category ID
     * @param userId - The user ID
     * @param recursive - Include feeds from subcategories
     * @returns Array of user_feeds
     */
    async getFeedsInCategory(categoryId: string, userId: string, recursive: boolean = false): Promise<UserFeed[]> {
        try {
            const category = await this.getCategory(categoryId, userId);

            if (!recursive) {
                return category.user_feeds || [];
            }

            // Get all descendant categories
            const descendantIds = await this.getAllDescendants(categoryId, userId);
            descendantIds.push(categoryId);

            // Get feeds from all these categories
            return await this.userFeedRepository.find({
                where: descendantIds.map(id => ({ category_id: id, user_id: userId })),
                relations: ['feed']
            });
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error getting feeds in category:', error);
            throw new HttpError(500, 'Failed to get category feeds');
        }
    }

    /**
     * Get all descendant category IDs
     * @param categoryId - The category ID
     * @param userId - The user ID
     * @returns Array of descendant category IDs
     */
    private async getAllDescendants(categoryId: string, userId: string): Promise<string[]> {
        const descendants: string[] = [];
        const queue: string[] = [categoryId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const children = await this.categoryRepository.find({
                where: { parent_id: currentId, user_id: userId }
            });

            for (const child of children) {
                descendants.push(child.id);
                queue.push(child.id);
            }
        }

        return descendants;
    }
}
