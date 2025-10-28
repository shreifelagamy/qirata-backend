import { EntityManager, Repository } from 'typeorm';
import { AppDataSource } from '../app';
import { CreateLinkDto } from '../dtos/link.dto';
import { Link } from '../entities/link.entity';
import { UserFeed } from '../entities/user-feed.entity';
import { Feed } from '../entities/feed.entity';
import { HttpError } from '../middleware/error.middleware';
import { LinkModel } from '../models/link.model';
import { logger } from '../utils/logger';
import { RSSService } from './content/rss.service';
import { ScraperService } from './content/scraper.service';
import { FeedService } from './content/feed.service';

interface ProcessRssResult {
    linkData: CreateLinkDto;
    multipleFeeds?: string[];
}

export class LinksService {
    private linkModel: LinkModel;
    private rssService: RSSService;
    private scraperService: ScraperService;
    private feedService: FeedService;
    private userFeedRepository: Repository<UserFeed>;
    private feedRepository: Repository<Feed>;

    constructor() {
        this.linkModel = new LinkModel();
        this.rssService = new RSSService();
        this.scraperService = new ScraperService();
        this.feedService = new FeedService();
        this.userFeedRepository = AppDataSource.getRepository(UserFeed);
        this.feedRepository = AppDataSource.getRepository(Feed);
    }

    async processLink(data: CreateLinkDto): Promise<ProcessRssResult> {
        try {
            // If RSS URL is provided in the request, validate it and still try to get favicon from main URL
            if (data.rss_url) {
                await this.validateRssUrl(data.rss_url);
                const { faviconUrl } = await this.rssService.findFeedUrlsAndFavicon(data.url);
                return {
                    linkData: {
                        ...data,
                        is_rss: false,
                        name: !data.name ? this.scraperService.extractNameFromUrl(data.rss_url) : data.name,
                        favicon_url: faviconUrl
                    }
                };
            }

            // Get RSS feed links and favicon in a single request
            const { feedUrls: feedLinks, faviconUrl } = await this.rssService.findFeedUrlsAndFavicon(data.url);

            // If no RSS feed found, reject the link
            if (!feedLinks) {
                throw new HttpError(400, 'No RSS feed found for this URL. We currently only accept blogs with public RSS feeds.');
            }

            // If multiple feed links found, validate each and return them for user selection
            if (Array.isArray(feedLinks) && feedLinks.length > 1) {
                // Validate all found feeds
                const validatedFeeds = await this.validateMultipleRssUrls(feedLinks);
                if (validatedFeeds.length === 0) {
                    throw new HttpError(422, 'Found RSS feed links, but none contain valid RSS content with articles.');
                }
                return {
                    linkData: { ...data, favicon_url: faviconUrl },
                    multipleFeeds: validatedFeeds
                };
            }

            // Single feed found - validate it
            const singleFeedUrl = Array.isArray(feedLinks) ? feedLinks[0] : feedLinks;
            await this.validateRssUrl(singleFeedUrl);

            // Create the link based on feed detection results
            const linkData = {
                ...data,
                is_rss: false,
                rss_url: "",
                favicon_url: faviconUrl
            };

            // If a single feed URL was found and it's different from the submitted URL
            if (singleFeedUrl !== data.url) {
                linkData.rss_url = singleFeedUrl;
                if (!data.name) {
                    linkData.name = this.scraperService.extractNameFromUrl(singleFeedUrl);
                }
            }
            // If the submitted URL itself is a feed - save as both url and rss_url
            else {
                linkData.is_rss = true;
                linkData.rss_url = data.url; // Save RSS URL as both url and rss_url
                if (!data.name) {
                    linkData.name = this.scraperService.extractNameFromUrl(data.url);
                }
            }

            return { linkData };
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error processing link:', error);
            // Differentiate between different types of access errors
            if ((error as Error).message?.includes('Access to this website is blocked')) {
                throw new HttpError(400, (error as Error).message);
            }
            if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('network') || (error as Error).message?.includes('timeout')) {
                throw new HttpError(503, 'Unable to access the URL. Please check the URL and try again.');
            }
            throw new HttpError(500, 'Failed to process link');
        }
    }

    async addLink(data: CreateLinkDto, userId: string): Promise<Link> {
        try {
            if (!data.url || data.url.trim() === '') {
                throw new HttpError(400, 'URL is required');
            }

            // Check if user already subscribed to this feed
            const existingUserFeed = await this.userFeedRepository.findOne({
                where: { user_id: userId },
                relations: ['feed']
            });

            if (existingUserFeed && existingUserFeed.feed.url === data.rss_url) {
                throw new HttpError(409, 'You are already subscribed to this feed');
            }

            // Create or get global feed
            const feed = await this.feedService.getOrCreateFeed(
                data.rss_url,
                data.name,
                data.favicon_url
            );

            // Create user_feed subscription
            const userFeed = this.userFeedRepository.create({
                user_id: userId,
                feed_id: feed.id,
                custom_name: data.name !== feed.name ? data.name : undefined,
                subscribed_at: new Date()
            });

            await this.userFeedRepository.save(userFeed);

            // Increment subscriber count
            await this.feedService.incrementSubscriberCount(feed.id);

            // Still create Link for backward compatibility
            await this.validateUniqueRSSUrl(data.rss_url, userId);
            const linkData = { ...data, user_id: userId };
            const link = await this.linkModel.create(linkData);

            return link;
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error adding link:', error);

            // Handle database-related errors
            if ((error as Error).message?.includes('duplicate') || (error as Error).message?.includes('unique')) {
                throw new HttpError(409, 'A link with this URL already exists');
            }
            if ((error as Error).message?.includes('validation') || (error as Error).message?.includes('constraint')) {
                throw new HttpError(400, 'Invalid link data provided');
            }

            throw new HttpError(500, 'Failed to add link');
        }
    }

    async getLinks(userId: string): Promise<UserFeed[]> {
        try {
            // Return user_feeds with feed metadata instead of just links
            return await this.userFeedRepository.find({
                where: { user_id: userId },
                relations: ['feed', 'category'],
                order: { subscribed_at: 'DESC' }
            });
        } catch (error) {
            logger.error('Error getting links:', error);

            // Handle authentication/authorization errors
            if ((error as Error).message?.includes('unauthorized') || (error as Error).message?.includes('forbidden')) {
                throw new HttpError(403, 'Access denied to user links');
            }

            throw new HttpError(500, 'Failed to get links');
        }
    }


    async fetchPosts(id: string, userId: string): Promise<{ link: Link; insertedCount: number }> {
        try {
            if (!Link.isValidUUID(id)) {
                throw new HttpError(400, 'Invalid link ID format');
            }

            const link = await this.linkModel.findByIdAndUser(id, userId);
            if (!link) {
                throw new HttpError(404, "Link not found or access denied");
            }
            if (!link.rss_url) {
                throw new HttpError(400, "Link does not have an RSS feed configured");
            }

            // Get the feed from the global registry
            const feed = await this.feedService.getFeedByUrl(link.rss_url);
            if (!feed) {
                throw new HttpError(404, 'Feed not found in registry');
            }

            // Fetch posts using FeedService (creates global posts with deduplication)
            const { feed: updatedFeed, insertedCount } = await this.feedService.fetchFeed(feed.id);

            // Update link's last_fetch_at
            link.last_fetch_at = new Date();
            await this.linkModel.update(link.id, { last_fetch_at: link.last_fetch_at });

            return { link, insertedCount };
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error(`Error fetching posts for link ${id}:`, error);

            // Handle RSS-related errors
            if ((error as Error).message?.includes('parse') || (error as Error).message?.includes('feed') || (error as Error).message?.includes('XML')) {
                throw new HttpError(422, 'Unable to parse RSS feed. The feed may be invalid or corrupted.');
            }
            if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('network') || (error as Error).message?.includes('timeout')) {
                throw new HttpError(503, 'Unable to access RSS feed. Please try again later.');
            }

            throw new HttpError(500, 'Failed to fetch posts');
        }
    }

    async deleteLink(id: string, userId: string): Promise<void> {
        try {
            if (!Link.isValidUUID(id)) {
                throw new HttpError(400, 'Invalid link ID format');
            }

            // Get the link to find associated feed
            const link = await this.linkModel.findByIdAndUser(id, userId);
            if (!link) {
                throw new HttpError(404, 'Link not found or access denied');
            }

            // Find and delete user_feed subscription
            const feed = await this.feedService.getFeedByUrl(link.rss_url);
            if (feed) {
                const userFeed = await this.userFeedRepository.findOne({
                    where: { user_id: userId, feed_id: feed.id }
                });

                if (userFeed) {
                    await this.userFeedRepository.remove(userFeed);
                    // Decrement subscriber count
                    await this.feedService.decrementSubscriberCount(feed.id);
                }
            }

            // Delete the link (for backward compatibility)
            await this.linkModel.deleteByUser(id, userId);
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error(`Error deleting link ${id}:`, error);

            // Handle specific deletion errors
            if ((error as Error).message?.includes('not found') || (error as Error).message?.includes('does not exist')) {
                throw new HttpError(404, 'Link not found or access denied');
            }
            if ((error as Error).message?.includes('constraint') || (error as Error).message?.includes('foreign key')) {
                throw new HttpError(409, 'Cannot delete link. It has associated data that must be removed first.');
            }

            throw new HttpError(500, 'Failed to delete link');
        }
    }

    private async validateUniqueRSSUrl(rss_url: string, userId: string): Promise<void> {
        const existingLink = await this.linkModel.findByRssUrlAndUser(rss_url, userId);
        if (existingLink) {
            throw new HttpError(400, 'URL already exists');
        }
    }

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

            // Handle different types of errors with appropriate status codes
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

    private async detectRssFeed(url: string): Promise<string | null> {
        try {
            // Implement RSS feed detection logic here
            // This is a placeholder that should be replaced with actual RSS detection code
            return null;
        } catch (error) {
            logger.error('Error detecting RSS feed:', error);
            return null;
        }
    }
}