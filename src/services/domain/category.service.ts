import AppDataSource from '../../config/database.config';
import { Category } from '../../entities/category.entity';
import { UserFeed } from '../../entities/user-feed.entity';
import { HttpError } from '../../middleware/error.middleware';
import { CategoryRepository } from '../../repositories';
import { logger } from '../../utils/logger';

export interface CreateCategoryDto {
    name: string;
}

export interface UpdateCategoryDto {
    name?: string;
}

/**
 * CategoryService - Manages user feed categories/folders
 *
 * Responsibilities:
 * - CRUD operations for flat categories
 * - User-specific category management
 * - Feed organization within categories
 */
export class CategoryService {
    /**
     * Create a new category for a user
     * @param data - Category creation data
     * @param userId - The user ID
     * @returns The created category
     */
    async createCategory(data: CreateCategoryDto, userId: string): Promise<Category> {
        try {
            // Check for duplicate name
            const existing = await CategoryRepository.findDuplicate(userId, data.name);

            if (existing) {
                throw new HttpError(409, 'Category with this name already exists');
            }

            const category = CategoryRepository.create({
                user_id: userId,
                name: data.name
            });

            return await CategoryRepository.save(category);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error creating category:', error);
            throw new HttpError(500, 'Failed to create category');
        }
    }

    /**
     * Get all categories for a user as a flat list ordered by name
     * @param userId - The user ID
     * @returns Array of categories with user_feeds and feed data
     */
    async getUserCategories(userId: string): Promise<Category[]> {
        try {
            return await CategoryRepository.findByUserId(userId);
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
            const category = await CategoryRepository.findByIdAndUserId(id, userId);

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

            if (data.name) {
                // Check for duplicate name
                const existing = await CategoryRepository.findDuplicate(userId, data.name);

                if (existing && existing.id !== id) {
                    throw new HttpError(409, 'Category with this name already exists');
                }

                category.name = data.name;
            }

            return await CategoryRepository.save(category);
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
     */
    async deleteCategory(id: string, userId: string): Promise<void> {
        try {
            const category = await this.getCategory(id, userId);

            // Move feeds in this category to uncategorized (category_id = null)
            if (category.user_feeds && category.user_feeds.length > 0) {
                await AppDataSource.getRepository(UserFeed)
                    .createQueryBuilder()
                    .update(UserFeed)
                    .set({ category_id: () => 'NULL' })
                    .where('category_id = :id', { id })
                    .execute();
            }

            await CategoryRepository.remove(category);
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

            const userFeedRepository = AppDataSource.getRepository(UserFeed);

            // Update all specified feeds using update() so that null is correctly
            // persisted as NULL in the database (save() treats undefined as "skip column").
            for (const feedId of feedIds) {
                await userFeedRepository.update(
                    { id: feedId, user_id: userId },
                    { category_id: categoryId as any }
                );
            }
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error moving feeds to category:', error);
            throw new HttpError(500, 'Failed to move feeds');
        }
    }

    /**
     * Get all feeds in a category
     * @param categoryId - The category ID
     * @param userId - The user ID
     * @returns Array of user_feeds with feed relation
     */
    async getFeedsInCategory(categoryId: string, userId: string): Promise<UserFeed[]> {
        try {
            const category = await this.getCategory(categoryId, userId);
            return category.user_feeds || [];
        } catch (error) {
            if (error instanceof HttpError) throw error;
            logger.error('Error getting feeds in category:', error);
            throw new HttpError(500, 'Failed to get category feeds');
        }
    }
}
