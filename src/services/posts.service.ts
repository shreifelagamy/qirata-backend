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
            // Decide if RSS content is full enough
            yield { state: 'deciding_content', step: 'Analyzing RSS content completeness...', progress: 5 };
            const isContentFull = this.isRssContentFull(post);

            if (isContentFull) {
                // Fast path: use RSS content directly
                yield { state: 'using_rss_content', step: 'Using RSS content (sufficient quality)...', progress: 15 };
                yield* this.createExpandedFromRss(post);
            } else {
                // Slow path: need to scrape
                yield* this.createExpandedContent(post);
            }
        }

        // Mark post as read after successful preparation (non-blocking)
        this.markAsRead(id, userId).catch(err =>
            logger.warn(`Failed to mark post ${id} as read:`, err)
        );

        return { chat_session_id: chatSession.id };
    }

    /**
     * Determine if RSS content is full enough for AI discussion
     * Uses multiple heuristics to decide
     */
    private isRssContentFull(post: Post): boolean {
        if (!post.content || post.content.trim().length === 0) {
            return false;
        }

        const content = post.content.trim();
        const contentLength = content.length;

        // Heuristic 1: Minimum length (at least 500 chars for meaningful discussion)
        if (contentLength < 500) {
            logger.info(`Post ${post.id}: Content too short (${contentLength} chars)`);
            return false;
        }

        // Heuristic 2: Check for truncation markers
        const truncationMarkers = [
            '...',
            '[...]',
            '(more)',
            'read more',
            'continue reading',
            '… ', // unicode ellipsis
            'see more'
        ];

        const contentLower = content.toLowerCase();
        const hasTruncationMarker = truncationMarkers.some(marker =>
            contentLower.includes(marker.toLowerCase())
        );

        if (hasTruncationMarker) {
            logger.info(`Post ${post.id}: Contains truncation markers`);
            return false;
        }

        // Heuristic 3: Link density check
        // Count links in content - high link density suggests incomplete content
        const linkMatches = content.match(/<a\s+[^>]*href/gi) || [];
        const linkDensity = linkMatches.length / (contentLength / 100); // links per 100 chars

        if (linkDensity > 2) { // More than 2 links per 100 chars is suspicious
            logger.info(`Post ${post.id}: High link density (${linkDensity.toFixed(2)} per 100 chars)`);
            return false;
        }

        // All heuristics passed - content appears full
        logger.info(`Post ${post.id}: RSS content appears full (${contentLength} chars)`);
        return true;
    }

    /**
     * Create PostExpanded from RSS content (fast path)
     * Yields progress events during processing
     */
    private async *createExpandedFromRss(post: Post): AsyncGenerator<ProgressEvent, void, unknown> {
        yield { state: 'optimizing_for_ai', step: 'Optimizing RSS content for AI...', progress: 40 };

        const optimizedContent = this.optimizeContentForAI(post.content || '');

        yield { state: 'summarizing', step: 'Generating content summary...', progress: 70 };

        const { summarizePost } = await import('./ai/agents/post-summary.agent');
        const summary = await summarizePost({
            postContent: optimizedContent,
        });

        yield { state: 'saving_expanded', step: 'Saving prepared content...', progress: 90 };

        await PostExpandedRepository.save({
            post_id: post.id,
            content: optimizedContent,
            summary
        });
    }

    /**
     * Optimize content for AI (extracted from content-aggregation.service)
     */
    private optimizeContentForAI(content: string): string {
        if (!content || content.trim().length === 0) {
            return content;
        }

        try {
            // Remove excessive whitespace and normalize line breaks
            let optimized = content.replace(/\s+/g, ' ').trim();

            // Remove duplicate sections (common in scraped content)
            const sentences = optimized.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const uniqueSentences = [...new Set(sentences)];
            optimized = uniqueSentences.join('. ').trim();

            // Ensure proper sentence ending
            if (optimized && !optimized.match(/[.!?]$/)) {
                optimized += '.';
            }

            // Limit content length to prevent excessive token usage
            const maxLength = 8000; // Reasonable limit for AI processing
            if (optimized.length > maxLength) {
                optimized = optimized.substring(0, maxLength);
                // Try to end at a sentence boundary
                const lastSentenceEnd = optimized.lastIndexOf('.');
                if (lastSentenceEnd > maxLength * 0.8) {
                    optimized = optimized.substring(0, lastSentenceEnd + 1);
                }
            }

            logger.info(`Content optimized: ${content.length} -> ${optimized.length} characters`);
            return optimized;
        } catch (error) {
            logger.warn('Content optimization failed, returning original content:', error);
            return content;
        }
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
    private async *createExpandedContent(post: Post): AsyncGenerator<ProgressEvent, void, unknown> {
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

        // Forward progress events from the content scraper
        for await (const progress of generator) {
            const message = stageMessages[progress.stage] || 'Processing...';
            const progressValue = stageProgress[progress.stage] || 50;
            yield { state: progress.stage, step: message, progress: progressValue, meta: progress.meta };
        }

        // Get the final result from the generator
        const finalResult = await generator.next();
        if (!finalResult.value || !('content' in finalResult.value) || !('summary' in finalResult.value)) {
            throw new Error('Content aggregation returned no result');
        }

        const { content, summary } = finalResult.value;

        yield { state: 'saving_expanded', step: 'Saving expanded content...', progress: 95 };

        await PostExpandedRepository.save({
            post_id: post.id,
            content,
            summary
        });
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