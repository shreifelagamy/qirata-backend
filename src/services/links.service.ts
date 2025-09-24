import { EntityManager } from 'typeorm';
import { AppDataSource } from '../app';
import { CreateLinkDto } from '../dtos/link.dto';
import { CreatePostDto } from '../dtos/post.dto';
import { Link } from '../entities/link.entity';
import { HttpError } from '../middleware/error.middleware';
import { LinkModel } from '../models/link.model';
import { logger } from '../utils/logger';
import { RSSService } from './content/rss.service';
import { ScraperService } from './content/scraper.service';
import { PostsService } from './posts.service';
import { parseRSSDate, formatDateForDatabase } from '../utils/date.util';

interface ProcessRssResult {
    linkData: CreateLinkDto;
    multipleFeeds?: string[];
}

export class LinksService {
    private linkModel: LinkModel;
    private rssService: RSSService;
    private scraperService: ScraperService;
    private postsService: PostsService;

    constructor() {
        this.linkModel = new LinkModel();
        this.rssService = new RSSService();
        this.scraperService = new ScraperService();
        this.postsService = new PostsService();
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

    async getLinks(userId: string): Promise<Link[]> {
        try {
            return await this.linkModel.findByUserId(userId);
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

            // Parse and validate the RSS feed
            const feed = await this.rssService.parseFeed(link.rss_url);

            const feedEntries = this.rssService.extractEntries(feed);

            if (!feedEntries.length) {
                logger.warn(`No entries found in feed: ${link.rss_url}`);
                return { link, insertedCount: 0 };
            }

            // Check for existing posts to prevent duplicates
            const feedLinks = feedEntries.map(entry => entry.link);
            const [existingPosts] = await this.postsService.getPosts({
                external_links: feedLinks
            }, userId);

            const existingLinks = new Set(existingPosts.map(post => post.external_link));

            // Filter out entries that already exist
            const newEntries = feedEntries.filter(entry => !existingLinks.has(entry.link));

            // Create new posts from feed entries
            const newPosts: CreatePostDto[] = newEntries.map(entry => {
                // Parse the published date from the RSS feed
                const publishedDate = parseRSSDate(entry.pubDate);

                return {
                    title: entry.title || 'Untitled Post',
                    content: entry.description || entry.content || '',
                    external_link: entry.link,
                    source: link.name,
                    linkId: link.id,
                    image_url: entry.image_url, // Using feed content only, undefined for optional field
                    published_date: formatDateForDatabase(publishedDate)
                };
            });

            // Start a transaction for atomic operations
            const transaction = await AppDataSource.transaction(async (manager: EntityManager) => {
                // Bulk insert new posts
                if (newPosts.length > 0) {
                    await this.postsService.createMany(newPosts, userId, manager);
                }

                // Save updated link model
                link.last_fetch_at = new Date();
                const updatedLink = await manager.save(link);

                return { link: updatedLink, insertedCount: newPosts.length };
            });

            return transaction;
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