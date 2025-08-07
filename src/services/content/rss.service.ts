import FeedParser, { Item, Meta } from 'feedparser';
import { Readable } from 'stream';
import { FeedEntry, RSSFeed } from '../../types/content.types';
import { fetchWithTimeout, validateUrl } from '../../utils/http.util';
import { logger } from '../../utils/logger';

export class RSSService {
    /**
     * Finds RSS, Atom, or other feed URLs from a given web page URL.
     * Does not parse or validate the actual feed content.
     *
     * @param url The URL to check for feed links
     * @returns An array of feed URLs if multiple found, a single URL if only one found, or null if none found
     */
    async findFeedUrls(url: string): Promise<string[] | string | null> {
        try {
            if (!validateUrl(url)) {
                throw new Error('Invalid URL format');
            }

            // First, try to get HTML content and look for feed links
            const html = await fetchWithTimeout<string>(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const feedUrls = this.findFeedLinksInHtml(html, url);

            // If we found feed links, return them
            if (feedUrls.length > 0) {
                return feedUrls.length === 1 ? feedUrls[0] : feedUrls;
            }

            // If no feed links found, check if the URL itself might be a feed
            const feedPatterns = [
                /\.(rss|xml|atom)$/i,
                /\/(rss|feed|atom)$/i,
                /\/(feeds?|rss|atom)\//i,
                /\/syndication\//i,
                /feed\.xml/i,
                /rss\.xml/i,
                /atom\.xml/i
            ];

            const isRssLike = feedPatterns.some(pattern => pattern.test(url));

            return isRssLike ? url : null;

        } catch (error) {
            logger.error('Error detecting RSS feed:', error);
            return null;
        }
    }

    /**
     * Extracts feed URLs from HTML content by checking link tags and RSS/Atom patterns.
     *
     * @param html The HTML content to search for feed links
     * @param baseUrl The base URL to resolve relative URLs against
     * @returns Array of unique feed URLs found in the HTML
     */
    private findFeedLinksInHtml(html: string, baseUrl: string): string[] {
        const feedTypes = [
            'application/rss+xml',
            'application/atom+xml',
            'application/rdf+xml',
            'application/xml',
            'text/xml'
        ];

        // Regular expressions for different feed link patterns
        const patterns = [
            // Standard link tags with type attribute
            /<link[^>]+type=["']([^"']+)["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
            /<link[^>]+href=["']([^"']+)["'][^>]+type=["']([^"']+)["'][^>]*>/gi,
            // Feed links without type but with feed-related keywords in href
            /<link[^>]+href=["']([^"']*(?:feed|rss|atom)[^"']*\.(?:xml|rss|atom))["'][^>]*>/gi,
            // Alternative feed URLs in anchor tags
            /<a[^>]+href=["']([^"']*(?:feed|rss|atom)[^"']*\.(?:xml|rss|atom))["'][^>]*>/gi
        ];

        const feedUrls = new Set<string>();

        // Process each pattern
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                let url: string;
                
                if (pattern.source.includes('type=')) {
                    // For links with type attribute
                    const [_, type, foundUrl] = match;
                    if (feedTypes.some(feedType => type.toLowerCase().includes(feedType))) {
                        url = foundUrl;
                    } else {
                        continue;
                    }
                } else {
                    // For links without type attribute but matching feed patterns
                    url = match[1];
                }

                // Convert relative URLs to absolute URLs
                const absoluteUrl = this.resolveUrl(url, baseUrl);
                feedUrls.add(absoluteUrl);
            }
        });

        return Array.from(feedUrls);
    }

    /**
     * Resolves a relative URL against a base URL to create an absolute URL.
     *
     * @param url The URL to resolve (may be relative or absolute)
     * @param baseUrl The base URL to resolve against
     * @returns The resolved absolute URL
     */
    private resolveUrl(url: string, baseUrl: string): string {
        // If URL is already absolute, return as-is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        try {
            const base = new URL(baseUrl);
            
            // Handle relative URLs that start with /
            if (url.startsWith('/')) {
                return `${base.protocol}//${base.host}${url}`;
            }
            
            // Handle relative URLs without leading /
            const basePath = base.pathname.endsWith('/') ? base.pathname : base.pathname + '/';
            return `${base.protocol}//${base.host}${basePath}${url}`;
        } catch (error) {
            logger.warn(`Failed to resolve URL: ${url} against base: ${baseUrl}`, error);
            return url; // Return original URL if resolution fails
        }
    }

    async parseFeed(url: string): Promise<RSSFeed> {
        if (!validateUrl(url)) {
            throw new Error('Invalid URL format');
        }

        const startTime = Date.now();
        const response = await fetchWithTimeout<string>(url, {
            responseType: 'text',
            headers: {
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        });

        return new Promise((resolve, reject) => {
            const feed: RSSFeed = {
                title: '',
                link: url,
                entries: []
            };

            const feedparser = new FeedParser({ addmeta: true });
            const stream = new Readable();
            stream.push(response);
            stream.push(null);

            feedparser.on('error', reject);

            feedparser.on('meta', (meta: Meta) => {
                feed.title = meta.title;
                feed.description = meta.description;
                feed.language = meta.language;
                feed.lastBuildDate = meta.date || undefined;
            });

            feedparser.on('readable', function (this: FeedParser) {
                let item: Item;
                while (item = this.read()) {
                    const entry: FeedEntry = {
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubdate || item.date || undefined,
                        description: item.description,
                        content: item.summary || item.description,
                        author: item.author,
                        categories: item.categories || [],
                        guid: item.guid
                    };
                    feed.entries.push(entry);
                }
            });

            feedparser.on('end', () => {
                logger.info(`Feed parsed in ${Date.now() - startTime}ms: ${url}`);
                if (this.validateFeed(feed)) {
                    resolve(feed);
                } else {
                    reject(new Error('Invalid feed structure'));
                }
            });

            stream.pipe(feedparser);
        });
    }

    validateFeed(feed: RSSFeed): boolean {
        if (!feed.title || !feed.link || !Array.isArray(feed.entries)) {
            return false;
        }

        // Check if feed has at least one valid entry
        return feed.entries.some(entry =>
            entry.title &&
            entry.link &&
            (entry.description || entry.content)
        );
    }

    private extractImageFromContent(content: string): string | undefined {
        // Check for img tags
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
        const imgMatch = content.match(imgRegex);
        if (imgMatch && imgMatch[1]) {
            return imgMatch[1];
        }

        // Check for background-image URLs
        const bgRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i;
        const bgMatch = content.match(bgRegex);
        if (bgMatch && bgMatch[1]) {
            return bgMatch[1];
        }

        return undefined;
    }

    extractEntries(feed: RSSFeed): FeedEntry[] {
        if (!this.validateFeed(feed)) {
            throw new Error('Invalid feed structure');
        }

        return feed.entries.map(entry => {
            const content = entry.content || entry.description || '';
            const image_url = this.extractImageFromContent(content);

            return {
                ...entry,
                content,
                description: entry.description || content.substring(0, 200) || '',
                image_url
            };
        });
    }
}

export default new RSSService();