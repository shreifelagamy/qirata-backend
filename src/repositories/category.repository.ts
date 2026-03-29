import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Category } from '../entities/category.entity';

export interface CategoryRepository extends Repository<Category> {
    findByUserId(userId: string): Promise<Category[]>;
    findByIdAndUserId(id: string, userId: string): Promise<Category | null>;
    findDuplicate(userId: string, name: string): Promise<Category | null>;
}

export const CategoryRepository = AppDataSource.getRepository(Category).extend({
    /**
     * Find all categories for a user, ordered by name ASC
     */
    async findByUserId(userId: string): Promise<Category[]> {
        return this.find({
            where: { user_id: userId },
            relations: ['user_feeds', 'user_feeds.feed'],
            order: { name: 'ASC' }
        });
    },

    /**
     * Find a single category by id and user_id, with user_feeds relation
     */
    async findByIdAndUserId(id: string, userId: string): Promise<Category | null> {
        return this.findOne({
            where: { id, user_id: userId },
            relations: ['user_feeds']
        });
    },

    /**
     * Find a category with the same user_id and name (for uniqueness check)
     */
    async findDuplicate(userId: string, name: string): Promise<Category | null> {
        return this.findOne({
            where: { user_id: userId, name }
        });
    }
});
