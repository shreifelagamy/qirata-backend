import { logger } from '../../utils/logger';
import { summarizePost } from '../ai/agents/post-summary.agent';
import agentqlService from './agentql.service';
import scraper from './scraper.service';

interface ContentAggregationResult {
    content: string;
    summary: string;
}

export class ContentAggregationService {
    async aggregateContent(
        url: string,
        progressCallback?: (step: string, progress: number) => void
    ): Promise<ContentAggregationResult> {
        try {
            progressCallback?.('Extracting main content...', 20);

            // Try AgentQL direct URL extraction first
            const extractedData = await this.extractContentWithFallback(url);
            console.log(`Extracted data for ${url}:`, extractedData);
            let aggregatedContent = extractedData.postContent;

            progressCallback?.('Processing read more links...', 40);

            // Process read more links in parallel (max 3) with same optimization strategy
            if (extractedData.readMoreUrl && extractedData.readMoreUrl.length > 0) {
                const additionalContent = await this.processReadMoreLinks(
                    extractedData.readMoreUrl,
                    progressCallback
                );

                if (additionalContent) {
                    aggregatedContent += '\n\n' + additionalContent;
                }
            }

            progressCallback?.('Optimizing content for AI...', 80);

            // Optimize content for AI consumption
            const optimizedContent = this.optimizeContentForAI(aggregatedContent);

            progressCallback?.('Generating content summary...', 90);

            // Generate summary
            const summary = await summarizePost({
                postContent: optimizedContent,
            });

            logger.info(`Content aggregation completed for URL: ${url}`);

            return {
                content: optimizedContent,
                summary
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

            // If human verification is required, fallback to HTML scraping
            if (extractedData.isHumanVerificationRequired) {
                logger.warn(`Human verification detected for ${url}, falling back to HTML scraping`);
                const html = await scraper.scrapeHtml(url);
                return await agentqlService.extractFromHtml(html);
            }

            return extractedData;
        } catch (error) {
            logger.warn(`Direct AgentQL extraction failed for ${url}, falling back to HTML scraping:`, error);
            // Fallback to HTML scraping if direct extraction fails
            const html = await scraper.scrapeHtml(url);
            return await agentqlService.extractFromHtml(html);
        }
    }

    private async processReadMoreLinks(
        readMoreUrls: string[],
        progressCallback?: (step: string, progress: number) => void
    ): Promise<string> {
        const readMoreLinks = readMoreUrls.slice(0, 3); // Limit to 3 links
        const startTime = Date.now();
        logger.info(`Starting parallel processing of ${readMoreLinks.length} read more links`);

        // Process all read more links in parallel with same optimization strategy
        const readMorePromises = readMoreLinks.map(async (link, index) => {
            const linkStartTime = Date.now();
            try {
                progressCallback?.(`Following read more links (${index + 1}/${readMoreLinks.length})...`, 50 + (index * 10));
                logger.info(`Started processing read more link ${index + 1}: ${link}`);

                // Apply same optimization strategy: try direct URL first, fallback to HTML if needed
                const linkData = await this.extractContentWithFallback(link);
                const linkDuration = Date.now() - linkStartTime;
                logger.info(`Completed read more link ${index + 1} in ${linkDuration}ms: ${link.substring(0, 50)}...`);

                return linkData.postContent;
            } catch (error) {
                const linkDuration = Date.now() - linkStartTime;
                logger.warn(`Failed to extract content from read more link ${index + 1} after ${linkDuration}ms: ${link}`, error);
                return '';
            }
        });

        const readMoreContents = await Promise.all(readMorePromises);
        const totalDuration = Date.now() - startTime;
        const validContents = readMoreContents.filter(content => content.trim().length > 0);

        logger.info(`Parallel processing completed in ${totalDuration}ms. Valid content from ${validContents.length}/${readMoreLinks.length} links`);

        return validContents.join('\n\n');
    }

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
}

export default new ContentAggregationService();