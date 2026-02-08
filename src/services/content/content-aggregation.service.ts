import { logger } from '../../utils/logger';
import agentqlService from './agentql.service';
import scraper from './scraper.service';

interface ContentAggregationResult {
    content: string;
}

export interface ContentAggregationProgress {
    stage: 'scraping_main' | 'following_read_more' | 'optimizing_for_ai' | 'summarizing' | 'complete';
    meta?: { current?: number; total?: number };
}

export class ContentAggregationService {
    /**
     * Aggregate content from URL with progress tracking
     * Returns async generator that yields progress updates
     */
    async *aggregateContentWithProgress(url: string): AsyncGenerator<ContentAggregationProgress, ContentAggregationResult, undefined> {
        try {
            // Stage 1: Extract main content
            yield { stage: 'scraping_main' };

            const extractedData = await this.extractContentWithFallback(url);
            let aggregatedContent = extractedData.postContent;

            // Stage 2: Process read more links
            if (extractedData.readMoreUrl && extractedData.readMoreUrl.length > 0) {
                const readMoreLinks = extractedData.readMoreUrl.slice(0, 3);
                const total = readMoreLinks.length;

                for (let i = 0; i < total; i++) {
                    yield {
                        stage: 'following_read_more',
                        meta: { current: i + 1, total }
                    };

                    try {
                        const linkData = await this.extractContentWithFallback(readMoreLinks[i]);
                        if (linkData.postContent && linkData.postContent.trim().length > 0) {
                            aggregatedContent += '\n\n' + linkData.postContent;
                        }
                    } catch (error) {
                        logger.warn(`Failed to extract content from read more link ${i + 1}: ${readMoreLinks[i]}`, error);
                    }
                }
            }

            return {
                content: aggregatedContent,
            };
        } catch (error) {
            logger.error(`Content aggregation failed for URL: ${url}`, error);
            throw error;
        }
    }

    private async extractContentWithFallback(url: string) {
        try {
            // Try direct URL extraction first (most efficient)
            logger.info(`Attempting direct AgentQL extraction for: ${url}`);
            const extractedData = await agentqlService.extract(url);

            // Check if extraction was successful (has meaningful content)
            if (extractedData.postContent && extractedData.postContent.trim().length > 0) {
                // If human verification is required, fallback to HTML scraping
                if (extractedData.isHumanVerificationRequired) {
                    logger.warn(`Human verification detected for ${url}, falling back to HTML scraping`);
                    return await this.fallbackToHtmlExtraction(url);
                }

                logger.info(`Direct AgentQL extraction successful for: ${url}`);
                return extractedData;
            } else {
                // Empty content - treat as failure and fallback
                logger.warn(`Direct AgentQL extraction returned empty content for ${url}, falling back to HTML scraping`);
                return await this.fallbackToHtmlExtraction(url);
            }
        } catch (error) {
            logger.warn(`Direct AgentQL extraction failed for ${url}, falling back to HTML scraping:`, error);
            return await this.fallbackToHtmlExtraction(url);
        }
    }

    private async fallbackToHtmlExtraction(url: string) {
        try {
            logger.info(`Starting HTML fallback extraction for: ${url}`);
            const html = await scraper.scrapeHtml(url);

            if (!html || html.trim().length === 0) {
                throw new Error('Failed to scrape HTML content');
            }

            const result = await agentqlService.extractFromHtml(html);
            logger.info(`HTML fallback extraction completed for: ${url}`);
            return result;
        } catch (fallbackError) {
            logger.error(`Both direct AgentQL and HTML fallback failed for ${url}:`, fallbackError);
            // Return empty result to allow graceful degradation
            return {
                postContent: '',
                readMoreUrl: [],
                isHumanVerificationRequired: false
            };
        }
    }
}

export default new ContentAggregationService();