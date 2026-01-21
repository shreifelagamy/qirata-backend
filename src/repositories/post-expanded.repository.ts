import { Repository, UpdateResult } from 'typeorm';
import AppDataSource from '../config/database.config';
import { PostExpanded } from '../entities/post-expanded.entity';

export interface PostExpandedRepository extends Repository<PostExpanded> {
    findByPostId(postId: string): Promise<PostExpanded | null>;
    existsByPostId(postId: string): Promise<boolean>;
    updateSummary(postId: string, summary: string): Promise<UpdateResult>;
}

export const PostExpandedRepository = AppDataSource.getRepository(PostExpanded).extend({
    /**
     * Find expanded content by post ID
     */
    async findByPostId(postId: string): Promise<PostExpanded | null> {
        return this.findOne({
            where: { post_id: postId }
        });
    },

    /**
     * Check if expanded content exists for a post
     */
    async existsByPostId(postId: string): Promise<boolean> {
        const count = await this.count({
            where: { post_id: postId }
        });
        return count > 0;
    },

    /**
     * Update the summary for a post's expanded content
     */
    async updateSummary(postId: string, summary: string): Promise<UpdateResult> {
        return this.update(
            { post_id: postId },
            { summary }
        );
    }
});
