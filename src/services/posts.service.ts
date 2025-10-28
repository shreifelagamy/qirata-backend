import { EntityManager, Repository, UpdateResult } from 'typeorm';
import { AppDataSource } from '../app';
import { CreatePostDto, UpdatePostDto } from '../dtos/post.dto';
import { PostExpanded } from '../entities/post-expanded.entity';
import { Post } from '../entities/post.entity';
import { UserPost } from '../entities/user-post.entity';
import { UserFeed } from '../entities/user-feed.entity';
import { Feed } from '../entities/feed.entity';
import { HttpError } from '../middleware/error.middleware';
import { PostModel } from '../models/post.model';
import { PostFilters } from '../types/posts.types';
import { logger } from '../utils/logger';
import { ChatSessionService } from './chat-session.service';
import contentAggregationService from './content/content-aggregation.service';

export class PostsService {
    private postModel: PostModel;
    private chatSessionService: ChatSessionService;
    private postExpandedRepository: Repository<PostExpanded>;
    private userPostRepository: Repository<UserPost>;
    private userFeedRepository: Repository<UserFeed>;
    private postRepository: Repository<Post>;
    private feedRepository: Repository<Feed>;

    constructor() {
        this.postModel = new PostModel();
        this.chatSessionService = new ChatSessionService();
        this.postExpandedRepository = AppDataSource.getRepository(PostExpanded);
        this.userPostRepository = AppDataSource.getRepository(UserPost);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.postRepository = AppDataSource.getRepository(Post);
        this.feedRepository = AppDataSource.getRepository(Feed);
    }

    async createPost(data: CreatePostDto, userId: string, entityManager?: EntityManager): Promise<Post> {
        try {
            // Check for duplicate by external_link (global deduplication)
            const existingPost = await this.postRepository.findOne({
                where: { external_link: data.external_link }
            });

            if (existingPost) {
                logger.info(`Post with external_link ${data.external_link} already exists globally`);
                return existingPost;
            }

            // Create new global post (no user_id)
            return await this.postModel.create(data, entityManager);
        } catch (error) {
            logger.error('Error creating post:', error);
            throw new HttpError(500, 'Failed to create post');
        }
    }

    async createMany(data: CreatePostDto[], userId: string, entityManager?: EntityManager): Promise<Post[] | undefined> {
        try {
            if (!data.length) return;

            const manager = entityManager || AppDataSource.manager;

            // Check for existing posts by external_link to prevent duplicates
            const externalLinks = data.map(d => d.external_link);
            const existingPosts = await manager.find(Post, {
                where: externalLinks.map(link => ({ external_link: link }))
            });

            const existingLinks = new Set(existingPosts.map(p => p.external_link));

            // Filter out posts that already exist
            const newPosts = data.filter(d => !existingLinks.has(d.external_link));

            if (!newPosts.length) {
                logger.info('All posts already exist, skipping insert');
                return existingPosts;
            }

            // Create new posts (without user_id)
            const postEntities = newPosts.map((model: CreatePostDto) => manager.create(Post, model));

            const insertedPosts = await manager.save(postEntities);

            // Return both existing and newly inserted posts
            return [...existingPosts, ...insertedPosts];
        } catch (error) {
            logger.error('Error creating multiple posts:', error);
            throw new HttpError(500, 'Failed to create posts');
        }
    }

    async getPosts(filters: PostFilters, userId: string): Promise<[Post[], number]> {
        try {
            // Query posts via user_feeds (only show posts from feeds user is subscribed to)
            const query = this.postRepository
                .createQueryBuilder('post')
                .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
                .leftJoinAndSelect('post.feed', 'feed')
                .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
                .addSelect([
                    'up.read_at as user_read_at',
                    'up.bookmarked as user_bookmarked'
                ]);

            // Handle sorting
            const sortBy = filters.sortBy || 'added_date';
            const sortOrder = filters.sortOrder || 'DESC';

            if (sortBy === 'published_date') {
                query.orderBy('post.published_date', sortOrder, 'NULLS LAST');
                query.addOrderBy('post.sequence_id', 'DESC');
            } else {
                query.orderBy('post.sequence_id', sortOrder);
            }

            // Apply filters
            if (filters.external_links?.length) {
                query.andWhere('post.external_link IN (:...links)', { links: filters.external_links });
            }

            if (filters.read !== undefined) {
                query.andWhere('up.read_at IS ' + (filters.read ? 'NOT NULL' : 'NULL'));
            }

            if (filters.link_id) {
                // For backward compatibility - link to feed
                const link = await AppDataSource.getRepository('Link').findOne({
                    where: { id: filters.link_id }
                });
                if (link && (link as any).rss_url) {
                    const feed = await this.feedRepository.findOne({
                        where: { url: (link as any).rss_url }
                    });
                    if (feed) {
                        query.andWhere('post.feed_id = :feedId', { feedId: feed.id });
                    }
                }
            }

            if (filters.search) {
                query.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)', {
                    search: `%${filters.search}%`
                });
            }

            if (filters.source) {
                query.andWhere('feed.name ILIKE :source', { source: `%${filters.source}%` });
            }

            if (filters.limit) {
                query.take(filters.limit);
            }

            if (filters.offset) {
                query.skip(filters.offset);
            }

            return await query.getManyAndCount();
        } catch (error) {
            logger.error('Error getting posts:', error);
            throw new HttpError(500, 'Failed to get posts');
        }
    }

    async getPost(id: string, userId: string): Promise<Post> {
        try {
            // Get post and check if user has access via user_feeds
            const post = await this.postRepository
                .createQueryBuilder('post')
                .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
                .leftJoinAndSelect('post.feed', 'feed')
                .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
                .addSelect(['up.read_at', 'up.bookmarked'])
                .where('post.id = :id', { id })
                .getOne();

            if (!post) {
                throw new HttpError(404, 'Post not found or access denied');
            }

            return post;
        } catch (error) {
            logger.error(`Error getting post ${id}:`, error);
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to get post');
        }
    }

    async updatePost(id: string, data: UpdatePostDto, userId: string): Promise<Post> {
        try {
            return await this.postModel.updateByUser(id, data, userId);
        } catch (error) {
            logger.error(`Error updating post ${id}:`, error);
            throw new HttpError(500, 'Failed to update post');
        }
    }

    async deletePost(id: string, userId: string): Promise<void> {
        try {
            await this.postModel.deleteByUser(id, userId);
        } catch (error) {
            logger.error(`Error deleting post ${id}:`, error);
            throw new HttpError(500, 'Failed to delete post');
        }
    }

    async markAsRead(id: string, userId: string): Promise<Post> {
        console.log(`Marking post ${id} as read...`);
        try {
            // Get the post to ensure it exists and user has access
            const post = await this.getPost(id, userId);

            // Check if user_post entry exists
            let userPost = await this.userPostRepository.findOne({
                where: { user_id: userId, post_id: id }
            });

            if (userPost) {
                // Update existing entry
                userPost.read_at = new Date();
                await this.userPostRepository.save(userPost);
            } else {
                // Create new user_post entry (on-demand)
                userPost = this.userPostRepository.create({
                    user_id: userId,
                    post_id: id,
                    read_at: new Date(),
                    bookmarked: false
                });
                await this.userPostRepository.save(userPost);
            }

            return post;
        } catch (error) {
            logger.error(`Error marking post ${id} as read:`, error);
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to mark post as read');
        }
    }

    async toggleBookmark(id: string, userId: string): Promise<{ post: Post; bookmarked: boolean }> {
        try {
            // Get the post to ensure it exists and user has access
            const post = await this.getPost(id, userId);

            // Check if user_post entry exists
            let userPost = await this.userPostRepository.findOne({
                where: { user_id: userId, post_id: id }
            });

            let bookmarked: boolean;

            if (userPost) {
                // Toggle existing bookmark
                userPost.bookmarked = !userPost.bookmarked;
                bookmarked = userPost.bookmarked;
                await this.userPostRepository.save(userPost);
            } else {
                // Create new user_post entry (on-demand) with bookmark
                userPost = this.userPostRepository.create({
                    user_id: userId,
                    post_id: id,
                    bookmarked: true
                });
                await this.userPostRepository.save(userPost);
                bookmarked = true;
            }

            return { post, bookmarked };
        } catch (error) {
            logger.error(`Error toggling bookmark for post ${id}:`, error);
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to toggle bookmark');
        }
    }

    async getExpanded(id: string, userId: string): Promise<PostExpanded> {
        try {
            return await this.postModel.findExpandedByIdAndUser(id, userId);
        } catch (error) {
            logger.error(`Error getting expanded post ${id}:`, error);
            throw new HttpError(500, 'Failed to get expanded post data');
        }
    }

    async expandPost(
        id: string,
        userId: string,
        progressCallback?: (step: string, progress: number) => void
    ): Promise<Post & { chat_session_id: string }> {
        try {
            progressCallback?.('Initializing post expansion...', 5);

            const post = await this.getPost(id, userId);
            if (!post) {
                throw new HttpError(404, 'Post not found');
            }

            progressCallback?.('Setting up chat session...', 10);
            const chatSession = await this.ensureChatSession(post, userId);

            const existingExpanded = await this.postModel.findExpandedById(id).catch(() => null);
            if (!existingExpanded) {
                await this.createExpandedContent(post, userId, progressCallback);
            }

            // Mark post as read after successful expansion (non-blocking)
            this.markAsRead(id, userId);

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

    private async ensureChatSession(post: Post, userId: string) {
        let chatSession = await this.chatSessionService.findByPostId(post.id, userId);
        if (!chatSession) {
            chatSession = await this.chatSessionService.create({
                title: `Discussing: ${post.title}`,
                postId: post.id
            }, userId);
        }
        return chatSession!;
    }

    private async createExpandedContent(
        post: Post,
        userId: string,
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

    async getSources(includeCount: boolean = false, userId: string): Promise<string[] | { source: string; count: number }[]> {
        try {
            return await this.postModel.getSourcesByUser(includeCount, userId);
        } catch (error) {
            logger.error('Error getting sources:', error);
            throw new HttpError(500, 'Failed to get sources');
        }
    }
}