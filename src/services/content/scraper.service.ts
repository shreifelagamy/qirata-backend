import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { ScrapedContent } from '../../types/content.types';
import { fetchWithTimeout, validateUrl } from '../../utils/http.util';
import { logger } from '../../utils/logger';

export class ScraperService {
    private static readonly BOT_USER_AGENT = 'Mozilla/5.0 (compatible; QirataBot/1.0; +https://qirata.com/bot)';

    async scrapeHtml(url: string, options?: { timeout?: number }): Promise<string> {
        if (!validateUrl(url)) {
            throw new Error('Invalid URL format');
        }

        const startTime = Date.now();
        const html = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': ScraperService.BOT_USER_AGENT
            },
            timeout: options?.timeout || 30000
        });

        logger.info(`HTML scraped in ${Date.now() - startTime}ms: ${url}`);
        return html;
    }

    // function to extract name from url
    extractNameFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);

            // Get the hostname without www
            let hostname = urlObj.hostname.replace(/^www\./, '');

            // Remove the TLD (.com, .dev, etc.)
            const hostParts = hostname.split('.');
            if (hostParts.length > 1) {
                hostParts.pop(); // Remove TLD
            }

            // Handle subdomains (keep only the main domain)
            const domainName = hostParts[hostParts.length - 1] || hostParts[0];

            // Get path segments (remove empty strings and trailing slashes)
            const pathSegments = urlObj.pathname
                .split('/')
                .filter(segment => segment.length > 0);

            // Combine domain and path segments
            const allParts = [domainName, ...pathSegments];

            // Convert each part to readable format
            const formattedParts = allParts.map(part => {
                // Replace hyphens and underscores with spaces
                let name = part
                    .replace(/[-_]/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
                    .toLowerCase()
                    .trim();

                // Capitalize first letter of each word
                name = name.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                return name;
            });

            // Join with " - " separator
            return formattedParts.join(' - ');
        } catch (error) {
            return url; // Return original URL if parsing fails
        }
    }

    async scrapeUrl(url: string): Promise<ScrapedContent> {
        const html = await this.scrapeHtml(url);
        const $ = cheerio.load(html);

        const content = this.extractMainContent($);
        const metadata = this.extractMetadata($);
        const sanitizedContent = this.sanitizeContent(content);

        return {
            url,
            title: metadata.title || '',
            content: sanitizedContent,
            metadata,
            timestamp: new Date()
        };
    }

    extractMainContent($: cheerio.CheerioAPI): string {
        // Remove unwanted elements
        $('script, style, iframe, nav, header, footer, .ads, #ads, .advertisement').remove();

        // Try to find main content area
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '.main-content',
            '#main-content',
            '.post-content',
            '.entry-content',
            '.content'
        ];

        let mainContent = '';
        for (const selector of selectors) {
            const element = $(selector);
            if (element.length) {
                mainContent = element.html() || '';
                break;
            }
        }

        // If no main content area found, try to extract from body
        if (!mainContent) {
            const bodyText = $('body').clone();
            // Remove low-content-value elements
            bodyText.find('aside, nav, footer, header, .sidebar, .menu, .nav, .navigation').remove();
            mainContent = bodyText.html() || '';
        }

        return mainContent;
    }

    extractMetadata($: cheerio.CheerioAPI): Record<string, any> {
        const metadata: {
            title: string;
            description: string;
            author: string;
            publishDate: Date | null;
            modifiedDate: Date | null;
            image: string;
            keywords: string[];
        } = {
            title: $('title').text().trim(),
            description: '',
            author: '',
            publishDate: null,
            modifiedDate: null,
            image: '',
            keywords: []
        };

        // Meta tags
        $('meta').each((_, el) => {
            const name = $(el).attr('name')?.toLowerCase();
            const property = $(el).attr('property')?.toLowerCase();
            const content = $(el).attr('content');

            if (!content) return;

            switch (name || property) {
                case 'description':
                case 'og:description':
                    metadata.description = content;
                    break;
                case 'author':
                    metadata.author = content;
                    break;
                case 'article:published_time':
                case 'publishdate':
                    metadata.publishDate = new Date(content);
                    break;
                case 'article:modified_time':
                case 'modifieddate':
                    metadata.modifiedDate = new Date(content);
                    break;
                case 'og:image':
                case 'twitter:image':
                    metadata.image = content;
                    break;
                case 'keywords':
                    metadata.keywords = content.split(',').map(k => k.trim());
                    break;
            }
        });

        // Try to extract author from schema.org metadata
        const articleSchema = $('script[type="application/ld+json"]').filter((_, el) => {
            try {
                const schema = JSON.parse($(el).html() || '');
                return schema['@type'] === 'Article';
            } catch {
                return false;
            }
        });

        if (articleSchema.length) {
            try {
                const schema = JSON.parse(articleSchema.first().html() || '');
                if (schema.author?.name) {
                    metadata.author = schema.author.name;
                }
            } catch (error) {
                logger.error('Error parsing schema.org metadata:', error);
            }
        }

        return metadata;
    }

    sanitizeContent(content: string): string {
        return sanitizeHtml(content, {
            allowedTags: [
                'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'strong', 'em', 'b', 'i', 'u', 'br', 'hr',
                'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                'a', 'img', 'figure', 'figcaption', 'cite',
                'table', 'thead', 'tbody', 'tr', 'th', 'td'
            ],
            allowedAttributes: {
                'a': ['href', 'title', 'target'],
                'img': ['src', 'alt', 'title'],
                '*': ['class', 'id']
            },
            allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
            transformTags: {
                'a': (tagName, attribs) => ({
                    tagName,
                    attribs: {
                        ...attribs,
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    }
                })
            }
        });
    }
}

export default new ScraperService();