import { Repository } from 'typeorm';
import AppDataSource from '../../config/database.config';
import { Feed } from '../../entities/feed.entity';
import { Post } from '../../entities/post.entity';
import { UserFeed } from '../../entities/user-feed.entity';
import { HttpError } from '../../middleware/error.middleware';
import { PostRepository } from '../../repositories';
import { FeedEntry } from '../../types/content.types';
import { formatDateForDatabase, parseRSSDate } from '../../utils/date.util';
import { logger } from '../../utils/logger';
import { FeedLoggerService } from '../content/feed-logger.service';
import { RSSService, RssValidationResult, RssValidationErrorCode } from '../content/rss.service';
import { ScraperService } from '../content/scraper.service';

/**
 * FeedsService - Manages feed subscription system
 *
 * Responsibilities:
 * - Search for feeds in the global registry
 * - Discover RSS feeds from URLs
 * - Manage user subscriptions (subscribe, unsubscribe, list)
 * - Maintain subscriber counts
 */
export class FeedsService {
    private feedRepository: Repository<Feed>;
    private userFeedRepository: Repository<UserFeed>;
    private rssService: RSSService;
    private scraperService: ScraperService;
    private feedLoggerService: FeedLoggerService;

    constructor() {
        this.feedRepository = AppDataSource.getRepository(Feed);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.rssService = new RSSService();
        this.scraperService = new ScraperService();
        this.feedLoggerService = new FeedLoggerService();
    }

    /**
     * Search for feeds by name or url with fuzzy matching
     * @param query - Search query string
     * @param options - Pagination options (limit, offset)
     * @returns Paginated array of feeds ordered by relevance and subscriber count
     */
    async searchFeeds(query: string, options: { limit?: number; offset?: number } = {}) {
        try {
            // Sanitize and validate inputs
            const sanitizedQuery = query.trim();
            if (!sanitizedQuery) {
                throw new HttpError(400, 'Search query is required');
            }

            const limit = Math.min(Math.max(1, options.limit || 20), 50);
            const offset = Math.max(0, options.offset || 0);

            // Build query with fuzzy search on name and url
            const queryBuilder = this.feedRepository
                .createQueryBuilder('feed')
                .where('LOWER(feed.name) LIKE LOWER(:query)', { query: `%${sanitizedQuery}%` })
                .orWhere('LOWER(feed.url) LIKE LOWER(:query)', { query: `%${sanitizedQuery}%` })
                .andWhere('feed.status = :status', { status: 'active' });

            // Get total count
            const total = await queryBuilder.getCount();

            // Order by relevance (exact matches first) then subscriber count
            const feeds = await queryBuilder
                .orderBy(
                    `CASE
            WHEN LOWER(feed.name) = LOWER(:exactQuery) THEN 1
            WHEN LOWER(feed.url) = LOWER(:exactQuery) THEN 2
            WHEN LOWER(feed.name) LIKE LOWER(:startsQuery) THEN 3
            ELSE 4
          END`,
                    'ASC'
                )
                .addOrderBy('feed.subscriber_count', 'DESC')
                .addOrderBy('feed.created_at', 'DESC')
                .setParameters({
                    exactQuery: sanitizedQuery,
                    startsQuery: `${sanitizedQuery}%`
                })
                .skip(offset)
                .take(limit)
                .getMany();

            logger.info(`Search completed: query="${sanitizedQuery}", results=${feeds.length}, total=${total}`);
            return { feeds, total };
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error searching feeds:', error);
            throw new HttpError(500, 'Failed to search feeds');
        }
    }

    /**
     * Discover RSS feeds from a URL
     * @param url - The URL to discover feeds from
     * @returns Single feed object if one found, array of feed objects if multiple, or throws error if none
     */
    async discover(url: string) {
        try {
            // Validate URL format
            if (!url || url.trim() === '') {
                throw new HttpError(400, 'URL is required');
            }

            // Get RSS feed links and favicon
            const { feedUrls: feedLinks, faviconUrl } = await this.rssService.findFeedUrlsAndFavicon(url);

            // If no RSS feed found, reject
            if (!feedLinks) {
                throw new HttpError(400, 'No RSS feed found for this URL. We currently only accept blogs with public RSS feeds.');
            }

            // If multiple feed links found, validate each and return them
            if (Array.isArray(feedLinks) && feedLinks.length > 1) {
                const validatedFeeds = await this.rssService.validateMultipleRssUrls(feedLinks);
                if (validatedFeeds.length === 0) {
                    throw new HttpError(422, 'Found RSS feed links, but none contain valid RSS content with articles.');
                }

                // Create or get feeds for all valid URLs
                const feedPromises = validatedFeeds.map(async (feedUrl) => {
                    const name = this.scraperService.extractNameFromUrl(feedUrl);
                    return await this.getOrCreateFeed(feedUrl, name, faviconUrl);
                });

                const feeds = await Promise.all(feedPromises);
                logger.info(`Discovered ${feeds.length} feeds from URL: ${url}`);
                return feeds;
            }

            // Single feed found - validate it
            const singleFeedUrl = Array.isArray(feedLinks) ? feedLinks[0] : feedLinks;
            this.throwIfInvalid(await this.rssService.validateRssUrl(singleFeedUrl));

            // Create or get the feed
            const name = this.scraperService.extractNameFromUrl(singleFeedUrl);
            const feed = await this.getOrCreateFeed(singleFeedUrl, name, faviconUrl);

            logger.info(`Discovered single feed from URL: ${url}`);
            return feed;
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error discovering feed from URL:', error);

            // Handle different types of errors
            if ((error as Error).message?.includes('Access to this website is blocked')) {
                throw new HttpError(400, (error as Error).message);
            }
            if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('network') || (error as Error).message?.includes('timeout')) {
                throw new HttpError(503, 'Unable to access the URL. Please check the URL and try again.');
            }

            throw new HttpError(500, 'Failed to discover feed');
        }
    }

    /**
     * Subscribe a user to a feed by feed ID
     * @param userId - The user ID
     * @param feedId - The feed ID
     * @param customName - Optional custom name for the feed
     * @returns The created UserFeed subscription
     */
    async subscribeUserToFeed(userId: string, feedId: string, customName?: string) {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Check if feed exists
            const feed = await queryRunner.manager.findOne(Feed, {
                where: { id: feedId }
            });

            if (!feed) {
                throw new HttpError(404, 'Feed not found');
            }

            // Check if user is already subscribed
            const existingSubscription = await queryRunner.manager.findOne(UserFeed, {
                where: { user_id: userId, feed_id: feedId }
            });

            if (existingSubscription) {
                throw new HttpError(409, 'You are already subscribed to this feed');
            }

            // Create user_feed subscription
            const userFeed = queryRunner.manager.create(UserFeed, {
                user_id: userId,
                feed_id: feedId,
                custom_name: customName,
                subscribed_at: new Date()
            });

            await queryRunner.manager.save(UserFeed, userFeed);

            // Increment subscriber count
            await queryRunner.manager.increment(Feed, { id: feedId }, 'subscriber_count', 1);

            await queryRunner.commitTransaction();

            // Load the full subscription with relations
            const fullSubscription = await this.userFeedRepository.findOne({
                where: { id: userFeed.id },
                relations: ['feed', 'category']
            });

            logger.info(`User ${userId} subscribed to feed ${feedId}`);
            return fullSubscription!;
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error subscribing user to feed:', error);

            // Handle duplicate key errors
            if ((error as Error).message?.includes('duplicate') || (error as Error).message?.includes('unique')) {
                throw new HttpError(409, 'You are already subscribed to this feed');
            }

            throw new HttpError(500, 'Failed to subscribe to feed');
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Subscribe a user to a feed by RSS URL (creates feed if doesn't exist)
     * @param userId - The user ID
     * @param rssUrl - The RSS feed URL
     * @param customName - Optional custom name for the feed
     * @returns The created UserFeed subscription
     */
    async subscribeUserByRssUrl(userId: string, rssUrl: string, customName?: string) {
        try {
            // Validate RSS URL
            if (!rssUrl || rssUrl.trim() === '') {
                throw new HttpError(400, 'RSS URL is required');
            }

            // Validate the RSS feed
            this.throwIfInvalid(await this.rssService.validateRssUrl(rssUrl));

            // Get or create the feed
            const { faviconUrl } = await this.rssService.findFeedUrlsAndFavicon(rssUrl);
            const name = customName || this.scraperService.extractNameFromUrl(rssUrl);
            const feed = await this.getOrCreateFeed(rssUrl, name, faviconUrl);

            // Subscribe user to the feed
            return await this.subscribeUserToFeed(userId, feed.id, customName);
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error subscribing user by RSS URL:', error);
            throw new HttpError(500, 'Failed to subscribe to feed');
        }
    }

    /**
     * Get all subscriptions for a user
     * @param userId - The user ID
     * @param options - Pagination options (limit, offset)
     * @returns Paginated array of user subscriptions with feed details
     */
    async getUserSubscriptions(userId: string, options?: { limit?: number; offset?: number }) {
        try {
            const limit = Math.min(Math.max(1, options?.limit || 50), 100);
            const offset = Math.max(0, options?.offset || 0);

            const [subscriptions, total] = await this.userFeedRepository.findAndCount({
                where: { user_id: userId },
                relations: ['feed', 'category'],
                order: { subscribed_at: 'DESC' },
                skip: offset,
                take: limit
            });

            logger.info(`Retrieved ${subscriptions.length} subscriptions for user ${userId}`);
            return { subscriptions, total };
        } catch (error) {
            logger.error('Error getting user subscriptions:', error);
            throw new HttpError(500, 'Failed to get subscriptions');
        }
    }

    /**
     * Unsubscribe a user from a feed
     * @param userId - The user ID
     * @param feedId - The feed ID
     */
    async unsubscribeUser(userId: string, feedId: string) {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Find the subscription
            const userFeed = await queryRunner.manager.findOne(UserFeed, {
                where: { user_id: userId, feed_id: feedId },
                relations: ['feed']
            });

            if (!userFeed) {
                throw new HttpError(404, 'Subscription not found');
            }

            // Delete the subscription
            await queryRunner.manager.remove(UserFeed, userFeed);

            // Decrement subscriber count
            await queryRunner.manager.decrement(Feed, { id: feedId }, 'subscriber_count', 1);

            await queryRunner.commitTransaction();

            logger.info(`User ${userId} unsubscribed from feed ${feedId}`);
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error unsubscribing user from feed:', error);
            throw new HttpError(500, 'Failed to unsubscribe from feed');
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get or create a feed by URL
     * @param feedUrl - The feed URL
     * @param feedName - Feed name
     * @param faviconUrl - Optional favicon URL
     * @returns The feed entity
     */
    private async getOrCreateFeed(feedUrl: string, feedName?: string, faviconUrl?: string): Promise<Feed> {
        try {
            // Check if feed already exists
            let feed = await this.feedRepository.findOne({
                where: { url: feedUrl }
            });

            if (feed) {
                // Update feed metadata if provided
                let updated = false;
                if (feedName && feed.name !== feedName) {
                    feed.name = feedName;
                    updated = true;
                }
                if (faviconUrl && feed.favicon_url !== faviconUrl) {
                    feed.favicon_url = faviconUrl;
                    updated = true;
                }
                if (updated) {
                    await this.feedRepository.save(feed);
                }
                return feed;
            }

            // Create new feed
            feed = this.feedRepository.create({
                url: feedUrl,
                name: feedName || this.scraperService.extractNameFromUrl(feedUrl),
                favicon_url: faviconUrl,
                status: 'active',
                fetch_error_count: 0,
                subscriber_count: 0
            });

            feed = await this.feedRepository.save(feed);
            logger.info(`Created new feed: ${feed.url}`);
            return feed;
        } catch (error) {
            logger.error(`Error getting or creating feed ${feedUrl}:`, error);
            throw new HttpError(500, 'Failed to create feed');
        }
    }

    /**
     * Fetch and parse an RSS feed, creating/updating posts
     * Uses conditional requests (ETag, If-Modified-Since) to avoid unnecessary processing
     */
    async fetchFeed(feedId: string): Promise<{ feed: Feed; insertedCount: number }> {
        const startTime = Date.now();
        let statusCode: number | null = null;
        let insertedCount = 0;

        try {
            const feed = await this.feedRepository.findOne({ where: { id: feedId } });

            if (!feed) {
                throw new HttpError(404, 'Feed not found');
            }

            const fetchResult = await this.rssService.parseFeedWithCache(
                feed.url,
                feed.etag,
                feed.last_modified
            );

            const responseTimeMs = Date.now() - startTime;

            if (fetchResult.notModified) {
                statusCode = 304;
                logger.info(`Feed not modified (304): ${feed.url}`);

                feed.last_fetch_at = new Date();
                feed.fetch_error_count = 0;
                feed.status = 'active';
                await this.feedRepository.save(feed);

                await this.feedLoggerService.logFetchAttempt(feedId, statusCode, responseTimeMs, undefined, 0, false);
                return { feed, insertedCount: 0 };
            }

            statusCode = 200;

            if (!fetchResult.feed) {
                throw new Error('No feed data returned');
            }

            const entries = this.rssService.extractEntries(fetchResult.feed);

            if (!entries.length) {
                logger.warn(`No entries found in feed: ${feed.url}`);

                feed.last_fetch_at = new Date();
                feed.fetch_error_count = 0;
                feed.status = 'active';
                if (fetchResult.etag) feed.etag = fetchResult.etag;
                if (fetchResult.lastModified) feed.last_modified = fetchResult.lastModified;
                await this.feedRepository.save(feed);

                await this.feedLoggerService.logFetchAttempt(feedId, statusCode, responseTimeMs, undefined, 0, true);
                return { feed, insertedCount: 0 };
            }

            insertedCount = await this.createPostsFromEntries(entries, feed);

            feed.last_fetch_at = new Date();
            feed.fetch_error_count = 0;
            feed.status = 'active';
            if (fetchResult.etag) feed.etag = fetchResult.etag;
            if (fetchResult.lastModified) feed.last_modified = fetchResult.lastModified;
            await this.feedRepository.save(feed);

            await this.feedLoggerService.logFetchAttempt(feedId, statusCode, responseTimeMs, undefined, insertedCount, true);
            logger.info(`Feed fetched successfully: ${feed.url} - ${insertedCount} new posts`);

            return { feed, insertedCount };
        } catch (error) {
            const responseTimeMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error fetching feed ${feedId}:`, error);

            try {
                await this.feedLoggerService.logFetchAttempt(feedId, statusCode || 500, responseTimeMs, errorMessage, 0, false);
            } catch (logError) {
                logger.error('Error logging fetch attempt:', logError);
            }

            await this.handleFeedError(feedId);

            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'Failed to fetch feed');
        }
    }

    /**
     * Get feeds that need to be fetched (based on subscriber count and last fetch time)
     */
    async getFeedsToFetch(limit: number = 100): Promise<Feed[]> {
        try {
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
     * Create posts from RSS feed entries
     */
    private async createPostsFromEntries(entries: FeedEntry[], feed: Feed): Promise<number> {
        if (!entries.length) return 0;

        try {
            const posts = entries.map(entry => {
                const publishedDate = parseRSSDate(entry.pubDate);

                return PostRepository.create({
                    title: entry.title || 'Untitled Post',
                    content: entry.description || entry.content || '',
                    external_link: entry.link,
                    feed_id: feed.id,
                    image_url: entry.image_url,
                    published_date: formatDateForDatabase(publishedDate)
                });
            });

            const result = await PostRepository
                .createQueryBuilder()
                .insert()
                .into(Post)
                .values(posts)
                .orIgnore()
                .returning('id')
                .execute();

            return result.raw?.length || 0;
        } catch (error) {
            logger.error('Error creating posts from entries:', error);
            throw error;
        }
    }

    /**
     * Handle feed fetch errors - increment error count and mark as error after 5 failures
     */
    private async handleFeedError(feedId: string): Promise<void> {
        try {
            const feed = await this.feedRepository.findOne({ where: { id: feedId } });
            if (!feed) return;

            feed.fetch_error_count += 1;
            if (feed.fetch_error_count >= 5) {
                feed.status = 'error';
            }

            await this.feedRepository.save(feed);
        } catch (error) {
            logger.error(`Error handling feed error for ${feedId}:`, error);
        }
    }

    private static readonly ERROR_CODE_TO_HTTP: Record<RssValidationErrorCode, number> = {
        invalid_structure: 422,
        no_entries: 422,
        missing_fields: 422,
        parse_error: 422,
        invalid_url: 400,
        blocked: 400,
        network_error: 503,
        unknown: 500
    };

    /**
     * Maps an RSS validation result to an HttpError if invalid.
     */
    private throwIfInvalid(result: RssValidationResult): void {
        if (result.valid) return;

        const status = FeedsService.ERROR_CODE_TO_HTTP[result.errorCode || 'unknown'];
        throw new HttpError(status, result.error || 'Failed to validate RSS feed');
    }
}
