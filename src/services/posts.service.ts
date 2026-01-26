import { Repository, UpdateResult } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Feed } from '../entities/feed.entity';
import { PostExpanded } from '../entities/post-expanded.entity';
import { Post } from '../entities/post.entity';
import { UserFeed } from '../entities/user-feed.entity';
import { UserPost } from '../entities/user-post.entity';
import { HttpError } from '../middleware/error.middleware';
import { ChatSessionRepository, PostExpandedRepository, PostRepository, UserPostRepository } from '../repositories';
import { PostFilters, PrepareDiscussionResult, ProgressEvent } from '../types/posts.types';
import { logger } from '../utils/logger';
import { isFullContentAgent } from './ai/agents';
import ContentScrapper from './content/content-aggregation.service';

export class PostsService {
    private postExpandedRepository: Repository<PostExpanded>;
    private userPostRepository: Repository<UserPost>;
    private userFeedRepository: Repository<UserFeed>;
    private postRepository: Repository<Post>;
    private feedRepository: Repository<Feed>;

    constructor() {
        this.postExpandedRepository = AppDataSource.getRepository(PostExpanded);
        this.userPostRepository = AppDataSource.getRepository(UserPost);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.postRepository = AppDataSource.getRepository(Post);
        this.feedRepository = AppDataSource.getRepository(Feed);
    }

    async getPosts(filters: PostFilters, userId: string): Promise<[Post[], number]> {
        try {
            // Query posts via user_feeds (only show posts from feeds user is subscribed to)
            const query = this.postRepository
                .createQueryBuilder('post')
                .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
                .leftJoinAndSelect('post.feed', 'feed')
                .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
                .addSelect('up.read_at', 'user_read_at')
                .addSelect('up.bookmarked', 'user_bookmarked');

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

            if (filters.search) {
                query.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)', {
                    search: `%${filters.search}%`
                });
            }

            if (filters.feed_id) {
                query.andWhere('post.feed_id = :feedId', { feedId: filters.feed_id });
            }

            if (filters.limit) {
                query.take(filters.limit);
            }

            if (filters.offset) {
                query.skip(filters.offset);
            }

            // Use getRawAndEntities to get both entities and raw data with aliases
            const [rawResults, total] = await Promise.all([
                query.getRawAndEntities(),
                query.getCount()
            ]);

            // Map user-specific fields to entities
            const postsWithUserData = rawResults.entities.map((post, index) => {
                const raw = rawResults.raw[index];
                return {
                    ...post,
                    user_read_at: raw.user_read_at,
                    user_bookmarked: raw.user_bookmarked
                } as Post;
            });

            return [postsWithUserData, total];
        } catch (error) {
            logger.error('Error getting posts:', error);
            throw new HttpError(500, 'Failed to get posts');
        }
    }

    async getPost(id: string, userId: string): Promise<Post> {
        try {
            // Get post and check if user has access via user_feeds
            const result = await this.postRepository
                .createQueryBuilder('post')
                .innerJoin('user_feeds', 'uf', 'uf.feed_id = post.feed_id AND uf.user_id = :userId', { userId })
                .leftJoinAndSelect('post.feed', 'feed')
                .leftJoin('user_posts', 'up', 'up.post_id = post.id AND up.user_id = :userId', { userId })
                .addSelect('up.read_at', 'user_read_at')
                .addSelect('up.bookmarked', 'user_bookmarked')
                .where('post.id = :id', { id })
                .getRawAndEntities();

            if (!result.entities.length) {
                throw new HttpError(404, 'Post not found or access denied');
            }

            // Map user-specific fields to the entity
            const post = result.entities[0];
            const raw = result.raw[0];

            return {
                ...post,
                user_read_at: raw.user_read_at,
                user_bookmarked: raw.user_bookmarked
            } as Post;
        } catch (error) {
            logger.error(`Error getting post ${id}:`, error);
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to get post');
        }
    }

    async getPostWithExpanded(id: string, userId: string): Promise<Post | null> {
        return PostRepository.findWithExpandedAndUserAccess(id, userId);
    }

    async markAsRead(id: string, userId: string): Promise<void> {
        try {
            const userPost = await UserPostRepository.findByUserAndPost(userId, id);

            // Only mark as read if not already read
            if (!userPost || !userPost.read_at) {
                const userPostData = userPost || UserPostRepository.create({
                    user_id: userId,
                    post_id: id,
                    bookmarked: false
                });

                userPostData.read_at = new Date();
                await UserPostRepository.save(userPostData);
            }
        } catch (error) {
            logger.error(`Error marking post ${id} as read:`, error);
            throw new HttpError(500, 'Failed to mark post as read');
        }
    }

    async getExpanded(id: string, userId: string): Promise<PostExpanded> {
        try {
            // Verify user has access to this post first
            await this.getPost(id, userId);

            const expanded = await this.postExpandedRepository.findOne({
                where: { post_id: id }
            });

            if (!expanded) {
                throw new HttpError(404, 'Expanded post data not found');
            }

            return expanded;
        } catch (error) {
            logger.error(`Error getting expanded post ${id}:`, error);
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to get expanded post data');
        }
    }

    /**
     * Prepare a post for AI discussion with early session emission and content-full heuristic
     * Yields progress events during processing and returns the chat session ID
     * @param id Post ID
     * @param userId User ID
     */
    async *prepareForDiscussion(id: string, userId: string): AsyncGenerator<ProgressEvent, PrepareDiscussionResult, unknown> {
        // Get post and verify access
        const post = await PostRepository.findWithUserAccess(id, userId);
        if (!post) {
            throw new HttpError(404, 'Post not found');
        }

        // Create/get chat session EARLY (before any content processing)
        const chatSession = await this.findOrCreateChatSession(post, userId);

        // Emit session ready event with chat_session_id in meta
        yield { state: 'session_ready', step: 'Chat session created', progress: 0, meta: { chat_session_id: chatSession.id } };

        // Check if PostExpanded already exists
        const existingExpanded = await PostExpandedRepository.findByPostId(id).catch(() => null);

        if (existingExpanded) {
            // Fast path: already expanded
            yield { state: 'ready', step: 'Content already prepared', progress: 100 };
        } else {
            // Use AI agent to decide if RSS content is full enough
            yield { state: 'deciding_content', step: 'Analyzing RSS content completeness...', progress: 5 };
            const contentCheck = await isFullContentAgent({ title: post.title, content: post.content || '' });

            logger.info(`Post ${post.id}: AI content check - isFull=${contentCheck.isFull}, confidence=${contentCheck.confidence}, reason=${contentCheck.reason}`);

            let content: string;

            if (contentCheck.isFull) {
                // Fast path: use RSS content directly
                logger.info(`Post ${post.id}: Using RSS content for discussion (fast path)`);
                content = post.content || '';
            } else {
                logger.info(`Post ${post.id}: Scraping content for discussion (slow path)`);
                // Slow path: need to scrape
                const generator = this.getExternalPostContent(post);
                while (true) {
                    const { value, done } = await generator.next();
                    if (done) {
                        content = value;
                        break;
                    }
                    const progress = value;
                    yield progress;
                }

            }

            // if content is empty return error
            if (!content || content.trim().length === 0) {
                throw new HttpError(500, 'Failed to prepare content for discussion');
            }

            // save post expanded
            yield { state: 'saving_expanded', step: 'Saving prepared content...', progress: 95 };

            await PostExpandedRepository.save({
                post_id: post.id,
                content: content,
            });

            yield { state: 'ready', step: 'Content prepared for discussion', progress: 100 };
        }

        // Mark post as read after successful preparation (non-blocking)
        this.markAsRead(id, userId).catch(err =>
            logger.warn(`Failed to mark post ${id} as read:`, err)
        );

        return { chat_session_id: chatSession.id };
    }


    private async findOrCreateChatSession(post: Post, userId: string) {
        let chatSession = await ChatSessionRepository.findByPostId(post.id, userId);
        if (!chatSession) {
            chatSession = await ChatSessionRepository.save({
                title: `Discussing: ${post.title}`,
                post_id: post.id,
                user_id: userId
            });
        }
        return chatSession;
    }

    /**
     * Create PostExpanded by scraping content (slow path)
     * Yields progress events during processing
     */
    private async *getExternalPostContent(post: Post): AsyncGenerator<ProgressEvent, string, unknown> {
        const stageMessages: Record<string, string> = {
            scraping_main: 'Extracting main content...',
            following_read_more: 'Following read more links...',
            optimizing_for_ai: 'Optimizing content for AI...',
            summarizing: 'Generating content summary...',
            complete: 'Complete'
        };

        const stageProgress: Record<string, number> = {
            scraping_main: 20,
            following_read_more: 50,
            optimizing_for_ai: 80,
            summarizing: 90,
            complete: 100
        };

        const generator = ContentScrapper.aggregateContentWithProgress(post.external_link);
        let content: string = '';

        while (true) {
            const { value, done } = await generator.next();
            if (done) {
                content = value.content;
                break;
            }

            const progress = value;
            const message = stageMessages[progress.stage] || 'Processing...';
            const progressValue = stageProgress[progress.stage] || 50;

            yield { state: progress.stage, step: message, progress: progressValue, meta: progress.meta };
        }

        return content;
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