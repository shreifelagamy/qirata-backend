import { EntityManager, Repository, UpdateResult } from 'typeorm';
import { AppDataSource } from '../app';
import { CreatePostDto, UpdatePostDto } from '../dtos/post.dto';
import { PostExpanded } from '../entities/post-expanded.entity';
import { Post } from '../entities/post.entity';
import { HttpError } from '../middleware/error.middleware';
import { PostModel } from '../models/post.model';
import { logger } from '../utils/logger';
import { ChatSessionService } from './chat-session.service';
import contentAggregationService from './content/content-aggregation.service';

interface PostFilters {
    read?: boolean;
    link_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
    external_links?: string[];
}

export class PostsService {
    private postModel: PostModel;
    private chatSessionService: ChatSessionService;
    private postExpandedRepository: Repository<PostExpanded>;

    constructor() {
        this.postModel = new PostModel();
        this.chatSessionService = new ChatSessionService();
        this.postExpandedRepository = AppDataSource.getRepository(PostExpanded);
    }

    async createPost(data: CreatePostDto, entityManager?: EntityManager): Promise<Post> {
        try {
            return await this.postModel.create(data, entityManager);
        } catch (error) {
            logger.error('Error creating post:', error);
            throw new HttpError(500, 'Failed to create post');
        }
    }

    async createMany(data: CreatePostDto[], entityManager?: EntityManager): Promise<Post[] | undefined> {
        try {
            if (!data.length) return;

            const manager = entityManager || AppDataSource.manager;
            const postEntities = data.map((model: CreatePostDto) => manager.create(Post, model));

            return await manager.save(postEntities);
        } catch (error) {
            logger.error('Error creating multiple posts:', error);
            throw new HttpError(500, 'Failed to create posts');
        }
    }

    async getPosts(filters: PostFilters): Promise<[Post[], number]> {
        try {
            return await this.postModel.findAll(filters);
        } catch (error) {
            logger.error('Error getting posts:', error);
            throw new HttpError(500, 'Failed to get posts');
        }
    }

    async getPost(id: string): Promise<Post> {
        try {
            return await this.postModel.findById(id);
        } catch (error) {
            logger.error(`Error getting post ${id}:`, error);
            throw new HttpError(500, 'Failed to get post');
        }
    }

    async updatePost(id: string, data: UpdatePostDto): Promise<Post> {
        try {
            return await this.postModel.update(id, data);
        } catch (error) {
            logger.error(`Error updating post ${id}:`, error);
            throw new HttpError(500, 'Failed to update post');
        }
    }

    async deletePost(id: string): Promise<void> {
        try {
            await this.postModel.delete(id);
        } catch (error) {
            logger.error(`Error deleting post ${id}:`, error);
            throw new HttpError(500, 'Failed to delete post');
        }
    }

    async markAsRead(id: string): Promise<Post> {
        console.log(`Marking post ${id} as read...`);
        try {
            return await this.postModel.markAsRead(id);
        } catch (error) {
            logger.error(`Error marking post ${id} as read:`, error);
            throw new HttpError(500, 'Failed to mark post as read');
        }
    }

    async getExpanded(id: string): Promise<PostExpanded> {
        try {
            return await this.postModel.findExpandedById(id);
        } catch (error) {
            logger.error(`Error getting expanded post ${id}:`, error);
            throw new HttpError(500, 'Failed to get expanded post data');
        }
    }

    async expandPost(
        id: string,
        progressCallback?: (step: string, progress: number) => void
    ): Promise<Post & { chat_session_id: string }> {
        try {
            progressCallback?.('Initializing post expansion...', 5);

            const post = await this.getPost(id);
            if (!post) {
                throw new HttpError(404, 'Post not found');
            }

            progressCallback?.('Setting up chat session...', 10);
            const chatSession = await this.ensureChatSession(post);

            const existingExpanded = await this.postModel.findExpandedById(id).catch(() => null);
            if (!existingExpanded) {
                await this.createExpandedContent(post, progressCallback);
            }

            // Mark post as read after successful expansion (non-blocking)
            this.markAsRead(id);

            progressCallback?.('Finalizing...', 100);

            return {
                ...post,
                chat_session_id: chatSession.id
            } as Post & { chat_session_id: string };
        } catch (error) {
            logger.error(`Error expanding post ${id}:`, error);
            throw error instanceof HttpError ? error : new HttpError(500, 'Failed to expand post');
        }
    }

    private async ensureChatSession(post: Post) {
        let chatSession = await this.chatSessionService.findByPostId(post.id);
        if (!chatSession) {
            chatSession = await this.chatSessionService.create({
                title: `Discussing: ${post.title}`,
                postId: post.id
            });
        }
        return chatSession!;
    }

    private async createExpandedContent(
        post: Post,
        progressCallback?: (step: string, progress: number) => void
    ): Promise<void> {
        const { content, summary } = await contentAggregationService.aggregateContent(
            post.external_link,
            progressCallback
        );

        progressCallback?.('Saving expanded content...', 95);

        const expanded = new PostExpanded({
            post_id: post.id,
            content,
            summary
        });

        await AppDataSource.manager.save(PostExpanded, expanded);
    }

    async updateExpandedSummary(postId: string, summary: string): Promise<UpdateResult> {
        try {
            const expanded = await this.postExpandedRepository.update(
                { post_id: postId }, { summary }
            );

            return expanded;
        } catch (error) {
            logger.error(`Error updating summary for post ${postId}:`, error);
            throw new HttpError(500, 'Failed to update post summary');
        }
    }
}