import { Repository } from 'typeorm';
import AppDataSource from '../config/database.config';
import { Feed } from '../entities/feed.entity';
import { UserFeed } from '../entities/user-feed.entity';
import { HttpError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { RSSService } from './content/rss.service';
import { ScraperService } from './content/scraper.service';

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

    constructor() {
        this.feedRepository = AppDataSource.getRepository(Feed);
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.rssService = new RSSService();
        this.scraperService = new ScraperService();
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
    async discoverFeedFromUrl(url: string) {
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
                const validatedFeeds = await this.validateMultipleRssUrls(feedLinks);
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
            await this.validateRssUrl(singleFeedUrl);

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
            await this.validateRssUrl(rssUrl);

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
     * Validate an RSS feed URL
     * @param rssUrl - The RSS URL to validate
     */
    private async validateRssUrl(rssUrl: string): Promise<void> {
        try {
            // Parse the RSS feed to validate its structure and content
            const feed = await this.rssService.parseFeed(rssUrl);

            // Check if feed has valid structure and content
            if (!this.rssService.validateFeed(feed)) {
                throw new HttpError(422, 'The RSS feed exists but has an invalid structure or is missing required content.');
            }

            // Check if feed has any entries/articles
            if (!feed.entries || feed.entries.length === 0) {
                throw new HttpError(422, 'The RSS feed is valid but contains no articles. Please ensure the feed has published content.');
            }

            // Validate that at least one entry has the required fields
            const hasValidEntries = feed.entries.some(entry =>
                entry.title &&
                entry.link &&
                (entry.description || entry.content)
            );

            if (!hasValidEntries) {
                throw new HttpError(422, 'The RSS feed exists but the articles are missing required information (title, link, or content).');
            }
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error validating RSS URL:', error);

            // Handle different types of errors
            if ((error as Error).message?.includes('Invalid URL format')) {
                throw new HttpError(400, 'Invalid RSS URL format. Please provide a valid URL.');
            }
            if ((error as Error).message?.includes('Access to this website is blocked')) {
                throw new HttpError(400, (error as Error).message);
            }
            if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('network') || (error as Error).message?.includes('timeout')) {
                throw new HttpError(503, 'Unable to access the RSS feed. Please check the URL and try again.');
            }
            if ((error as Error).message?.includes('parse') || (error as Error).message?.includes('XML') || (error as Error).message?.includes('feed')) {
                throw new HttpError(422, 'The URL does not contain valid RSS content. Please provide a direct link to an RSS feed.');
            }

            throw new HttpError(500, 'Failed to validate RSS feed');
        }
    }

    /**
     * Validate multiple RSS URLs
     * @param rssUrls - Array of RSS URLs to validate
     * @returns Array of valid RSS URLs
     */
    private async validateMultipleRssUrls(rssUrls: string[]): Promise<string[]> {
        const validFeeds: string[] = [];

        // Validate each RSS URL and collect only valid ones
        for (const rssUrl of rssUrls) {
            try {
                await this.validateRssUrl(rssUrl);
                validFeeds.push(rssUrl);
            } catch (error) {
                // Log validation failures but continue with other feeds
                logger.warn(`RSS validation failed for ${rssUrl}:`, (error as Error).message);
            }
        }

        return validFeeds;
    }
}
