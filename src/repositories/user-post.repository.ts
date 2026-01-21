import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { UserPost } from '../entities/user-post.entity';

export interface UserPostRepository extends Repository<UserPost> {
    findByUserAndPost(userId: string, postId: string): Promise<UserPost | null>;
}

export const UserPostRepository = AppDataSource.getRepository(UserPost).extend({
    /**
     * Find a user post entry by user ID and post ID
     */
    async findByUserAndPost(userId: string, postId: string): Promise<UserPost | null> {
        return this.findOne({
            where: { user_id: userId, post_id: postId }
        });
    }
});
