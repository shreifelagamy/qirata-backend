import { Repository } from 'typeorm';
import { AppDataSource } from '../../app';
import { Feed } from '../../entities/feed.entity';
import { Post } from '../../entities/post.entity';
import { UserFeed } from '../../entities/user-feed.entity';
import { HttpError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { RSSService } from './rss.service';
import { FeedEntry } from '../../types/content.types';
import { parseRSSDate, formatDateForDatabase } from '../../utils/date.util';

/**
 * FeedService - Manages global feed registry
 *
 * Responsibilities:
 * - Global feed storage and retrieval (one feed per URL)
 * - RSS fetching with conditional requests (ETag, If-Modified-Since)
 * - Feed health monitoring and error tracking
 * - Subscriber count management
 * - Creating/updating global posts with deduplication
 */
export class FeedService {
    private feedRepository: Repository<Feed>;
    private postRepository: Repository<Post>;
    private userFeedRepository: Repository<UserFeed>;
    private rssService: RSSService;

    constructor() {
        this.feedRepository = AppDataSource.getRepository(Feed);
        this.postRepository = AppDataSource.getRepository(Post);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.rssService = new RSSService();
    }

    /**
     * Get or create a feed by URL
     * @param feedUrl - The feed URL
     * @param feedName - Optional feed name
     * @param faviconUrl - Optional favicon URL
     * @returns The feed entity
     */
    async getOrCreateFeed(feedUrl: string, feedName?: string, faviconUrl?: string): Promise<Feed> {
        try {
            // Check if feed already exists
            let feed = await this.feedRepository.findOne({
                where: { url: feedUrl }
            });

            if (feed) {
                // Update feed metadata if provided
                if (feedName && feed.name !== feedName) {
                    feed.name = feedName;
                }
                if (faviconUrl && feed.favicon_url !== faviconUrl) {
                    feed.favicon_url = faviconUrl;
                }
                await this.feedRepository.save(feed);
                return feed;
            }

            // Create new feed
            feed = new Feed({
                url: feedUrl,
                name: feedName || this.extractNameFromUrl(feedUrl),
                favicon_url: faviconUrl,
                status: 'active',
                fetch_error_count: 0,
                subscriber_count: 0
            });

            return await this.feedRepository.save(feed);
        } catch (error) {
            logger.error(`Error getting or creating feed ${feedUrl}:`, error);
            throw new HttpError(500, 'Failed to create feed');
        }
    }

    /**
     * Fetch and parse an RSS feed, creating/updating posts
     * @param feedId - The feed ID
     * @returns Object with feed and count of new posts inserted
     */
    async fetchFeed(feedId: string): Promise<{ feed: Feed; insertedCount: number }> {
        try {
            const feed = await this.feedRepository.findOne({
                where: { id: feedId }
            });

            if (!feed) {
                throw new HttpError(404, 'Feed not found');
            }

            // Parse RSS feed with conditional request headers
            const parsedFeed = await this.rssService.parseFeed(feed.url);
            const entries = this.rssService.extractEntries(parsedFeed);

            if (!entries.length) {
                logger.warn(`No entries found in feed: ${feed.url}`);
                // Update last fetch time even if no entries
                feed.last_fetch_at = new Date();
                await this.feedRepository.save(feed);
                return { feed, insertedCount: 0 };
            }

            // Check for existing posts by external_link to prevent duplicates
            const feedLinks = entries.map(entry => entry.link);
            const existingPosts = await this.postRepository.find({
                where: feedLinks.map(link => ({ external_link: link }))
            });

            const existingLinks = new Set(existingPosts.map(post => post.external_link));

            // Filter out entries that already exist globally
            const newEntries = entries.filter(entry => !existingLinks.has(entry.link));

            // Create new global posts
            const insertedCount = await this.createPostsFromEntries(newEntries, feed);

            // Update feed metadata
            feed.last_fetch_at = new Date();
            feed.fetch_error_count = 0;
            feed.status = 'active';

            // Update last_modified and etag if available from response
            // Note: These would be extracted from HTTP headers in a more complete implementation

            await this.feedRepository.save(feed);

            return { feed, insertedCount };
        } catch (error) {
            logger.error(`Error fetching feed ${feedId}:`, error);

            // Update error tracking
            await this.handleFeedError(feedId);

            if (error instanceof HttpError) {
                throw error;
            }
            throw new HttpError(500, 'Failed to fetch feed');
        }
    }

    /**
     * Create posts from RSS feed entries
     * @param entries - The feed entries
     * @param feed - The feed entity
     * @returns Count of inserted posts
     */
    private async createPostsFromEntries(entries: FeedEntry[], feed: Feed): Promise<number> {
        if (!entries.length) return 0;

        try {
            const posts = entries.map(entry => {
                const publishedDate = parseRSSDate(entry.pubDate);

                return this.postRepository.create({
                    title: entry.title || 'Untitled Post',
                    content: entry.description || entry.content || '',
                    external_link: entry.link,
                    feed_id: feed.id,
                    image_url: entry.image_url,
                    published_date: formatDateForDatabase(publishedDate)
                });
            });

            // Bulk insert
            const insertedPosts = await this.postRepository.save(posts);
            return insertedPosts.length;
        } catch (error) {
            logger.error('Error creating posts from entries:', error);
            throw error;
        }
    }

    /**
     * Handle feed fetch errors
     * @param feedId - The feed ID
     */
    private async handleFeedError(feedId: string): Promise<void> {
        try {
            const feed = await this.feedRepository.findOne({
                where: { id: feedId }
            });

            if (!feed) return;

            feed.fetch_error_count += 1;

            // Mark feed as error status after 5 consecutive failures
            if (feed.fetch_error_count >= 5) {
                feed.status = 'error';
            }

            await this.feedRepository.save(feed);
        } catch (error) {
            logger.error(`Error handling feed error for ${feedId}:`, error);
        }
    }

    /**
     * Increment subscriber count for a feed
     * @param feedId - The feed ID
     */
    async incrementSubscriberCount(feedId: string): Promise<void> {
        try {
            await this.feedRepository.increment({ id: feedId }, 'subscriber_count', 1);
        } catch (error) {
            logger.error(`Error incrementing subscriber count for feed ${feedId}:`, error);
        }
    }

    /**
     * Decrement subscriber count for a feed
     * @param feedId - The feed ID
     */
    async decrementSubscriberCount(feedId: string): Promise<void> {
        try {
            await this.feedRepository.decrement({ id: feedId }, 'subscriber_count', 1);
        } catch (error) {
            logger.error(`Error decrementing subscriber count for feed ${feedId}:`, error);
        }
    }

    /**
     * Get feed by URL
     * @param feedUrl - The feed URL
     * @returns The feed entity or null
     */
    async getFeedByUrl(feedUrl: string): Promise<Feed | null> {
        try {
            return await this.feedRepository.findOne({
                where: { url: feedUrl }
            });
        } catch (error) {
            logger.error(`Error getting feed by URL ${feedUrl}:`, error);
            return null;
        }
    }

    /**
     * Get feed by ID
     * @param feedId - The feed ID
     * @returns The feed entity or null
     */
    async getFeedById(feedId: string): Promise<Feed | null> {
        try {
            return await this.feedRepository.findOne({
                where: { id: feedId }
            });
        } catch (error) {
            logger.error(`Error getting feed by ID ${feedId}:`, error);
            return null;
        }
    }

    /**
     * Get all feeds subscribed by a user
     * @param userId - The user ID
     * @returns Array of feeds with subscription metadata
     */
    async getUserFeeds(userId: string): Promise<Array<Feed & { subscribed_at: Date; custom_name?: string; category_id?: string }>> {
        try {
            const userFeeds = await this.userFeedRepository.find({
                where: { user_id: userId },
                relations: ['feed', 'category'],
                order: { subscribed_at: 'DESC' }
            });

            return userFeeds.map(uf => ({
                ...uf.feed,
                subscribed_at: uf.subscribed_at,
                custom_name: uf.custom_name,
                category_id: uf.category_id
            }));
        } catch (error) {
            logger.error(`Error getting user feeds for ${userId}:`, error);
            throw new HttpError(500, 'Failed to get user feeds');
        }
    }

    /**
     * Get feeds that need to be fetched (based on subscriber count and last fetch time)
     * High subscriber count feeds are prioritized
     * @param limit - Maximum number of feeds to return
     * @returns Array of feeds to fetch
     */
    async getFeedsToFetch(limit: number = 100): Promise<Feed[]> {
        try {
            // Fetch feeds that:
            // 1. Are active
            // 2. Haven't been fetched recently (e.g., last 15 minutes)
            // 3. Ordered by subscriber_count (higher priority)
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            return await this.feedRepository
                .createQueryBuilder('feed')
                .where('feed.status = :status', { status: 'active' })
                .andWhere('(feed.last_fetch_at IS NULL OR feed.last_fetch_at < :fetchTime)', {
                    fetchTime: fifteenMinutesAgo
                })
                .orderBy('feed.subscriber_count', 'DESC')
                .addOrderBy('feed.last_fetch_at', 'ASC', 'NULLS FIRST')
                .limit(limit)
                .getMany();
        } catch (error) {
            logger.error('Error getting feeds to fetch:', error);
            return [];
        }
    }

    /**
     * Extract a readable name from a feed URL
     * @param url - The feed URL
     * @returns A readable name
     */
    private extractNameFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            return hostname;
        } catch {
            return url;
        }
    }

    /**
     * Update feed health status
     * @param feedId - The feed ID
     * @param status - The new status
     */
    async updateFeedStatus(feedId: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
        try {
            await this.feedRepository.update({ id: feedId }, { status });
        } catch (error) {
            logger.error(`Error updating feed status for ${feedId}:`, error);
        }
    }

    /**
     * Reset error count for a feed (after successful fetch)
     * @param feedId - The feed ID
     */
    async resetFeedErrorCount(feedId: string): Promise<void> {
        try {
            await this.feedRepository.update({ id: feedId }, { fetch_error_count: 0 });
        } catch (error) {
            logger.error(`Error resetting error count for feed ${feedId}:`, error);
        }
    }
}
