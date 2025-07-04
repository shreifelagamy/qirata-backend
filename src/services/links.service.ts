import { EntityManager } from 'typeorm';
import { AppDataSource } from '../app';
import { CreateLinkDto, UpdateLinkDto } from '../dtos/link.dto';
import { CreatePostDto } from '../dtos/post.dto';
import { Link } from '../entities/link.entity';
import { HttpError } from '../middleware/error.middleware';
import { LinkModel } from '../models/link.model';
import { logger } from '../utils/logger';
import { RSSService } from './content/rss.service';
import { ScraperService } from './content/scraper.service';
import { PostsService } from './posts.service';

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
            // If RSS URL is provided in the request
            if (data.rss_url) {
                return {
                    linkData: {
                        ...data,
                        is_rss: false,
                        name: !data.name ? this.scraperService.extractNameFromUrl(data.rss_url) : data.name
                    }
                };
            }

            // Get RSS and feed links
            const feedLinks = await this.rssService.findFeedUrls(data.url);

            // If multiple feed links found, return them for user selection
            if (Array.isArray(feedLinks) && feedLinks.length > 1) {
                return {
                    linkData: data,
                    multipleFeeds: feedLinks
                };
            }

            // Create the link based on feed detection results
            const linkData = {
                ...data,
                is_rss: false,
                rss_url: ""
            };

            // If a single feed URL was found and it's different from the submitted URL
            if (feedLinks && !Array.isArray(feedLinks) && feedLinks !== data.url) {
                linkData.rss_url = feedLinks;
                if (!data.name) {
                    linkData.name = this.scraperService.extractNameFromUrl(feedLinks);
                }
            }
            // If the submitted URL itself is a feed
            else if (feedLinks === data.url) {
                linkData.is_rss = true;
                if (!data.name) {
                    linkData.name = this.scraperService.extractNameFromUrl(data.url);
                }
            }

            return { linkData };
        } catch (error) {
            logger.error('Error processing link:', error);
            throw new HttpError(500, 'Failed to process link');
        }
    }

    async addLink(data: CreateLinkDto): Promise<Link> {
        try {
            if (!data.url || data.url.trim() === '') {
                throw new HttpError(400, 'URL is required');
            }

            await this.validateUniqueRSSUrl(data.rss_url);
            const link = await this.linkModel.create(data);
            return link;
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error('Error adding link:', error);
            throw new HttpError(500, 'Failed to add link');
        }
    }

    async getLinks(): Promise<Link[]> {
        try {
            return await this.linkModel.findAll();
        } catch (error) {
            logger.error('Error getting links:', error);
            throw new HttpError(500, 'Failed to get links');
        }
    }

    async updateLink(id: string, data: UpdateLinkDto): Promise<Link> {
        try {
            if (!Link.isValidUUID(id)) {
                throw new HttpError(400, 'Invalid link ID format');
            }

            if (data.url && data.url.trim() === '') {
                throw new HttpError(400, 'URL cannot be empty');
            }

            if (data.url) {
                const existingLink = await this.linkModel.findByUrl(data.url);
                if (existingLink && existingLink.id !== id) {
                    throw new HttpError(400, 'URL already exists');
                }
            }

            return await this.linkModel.update(id, data);
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error(`Error updating link ${id}:`, error);
            throw new HttpError(500, 'Failed to update link');
        }
    }

    async fetchPosts(id: string): Promise<{ link: Link; insertedCount: number }> {
        try {
            if (!Link.isValidUUID(id)) {
                throw new HttpError(400, 'Invalid link ID format');
            }

            const link = await this.linkModel.findById(id);
            if (!link || !link.rss_url) {
                throw new Error("Link not found or not an RSS feed");
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
            });

            const existingLinks = new Set(existingPosts.map(post => post.external_link));

            // Filter out entries that already exist
            const newEntries = feedEntries.filter(entry => !existingLinks.has(entry.link));

            // Create new posts from feed entries
            const newPosts: CreatePostDto[] = newEntries.map(entry => ({
                title: entry.title || 'Untitled Post',
                content: entry.content || entry.description || '',
                external_link: entry.link,
                source: link.name,
                linkId: link.id,
                image_url: entry.image_url // Using feed content only, undefined for optional field
            }));

            // Start a transaction for atomic operations
            const transaction = await AppDataSource.transaction(async (manager: EntityManager) => {
                // Bulk insert new posts
                if (newPosts.length > 0) {
                    await this.postsService.createMany(newPosts, manager);
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
            throw new HttpError(500, 'Failed to fetch posts');
        }
    }

    async deleteLink(id: string): Promise<void> {
        try {
            if (!Link.isValidUUID(id)) {
                throw new HttpError(400, 'Invalid link ID format');
            }
            await this.linkModel.delete(id);
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            logger.error(`Error deleting link ${id}:`, error);
            throw new HttpError(500, 'Failed to delete link');
        }
    }

    private async validateUniqueRSSUrl(rss_url: string): Promise<void> {
        const existingLink = await this.linkModel.findByRssUrl(rss_url);
        if (existingLink) {
            throw new HttpError(400, 'URL already exists');
        }
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