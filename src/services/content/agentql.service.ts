import { fetchWithTimeout } from "../../utils/http.util";
import { logger } from "../../utils/logger";

interface AgentQLExtractResult {
    postContent: string;
    readMoreUrl: string[];
    isHumanVerificationRequired: boolean;
}

interface AgentQLParams {
    url?: string;
    html?: string;
    waitFor?: number;
    scrollToBottom?: boolean;
    mode?: string;
}

export class AgentQLService {
    private static readonly AGENTQL_QUERY = `{
        article_content(main article text with images in markdown format)
        same_article_continuation_links(only links that continue this exact article story, excluding all related articles, recommendations, or external links)[]
        verification_required(boolean if captcha or verification blocks access)
    }`;

    private static readonly DEFAULT_TIMEOUT = 60000; // Increased from 30s to 60s
    private static readonly API_ENDPOINT = 'https://api.agentql.com/v1/query-data';

    async extract(url: string): Promise<AgentQLExtractResult> {
        return this.performExtraction({
            url,
            waitFor: 3, // Increased from 2 to 3 seconds
            scrollToBottom: true,
            mode: "standard"
        });
    }

    async extractFromHtml(html: string): Promise<AgentQLExtractResult> {
        return this.performExtraction({
            html,
            mode: "standard"
        });
    }

    private async performExtraction(params: AgentQLParams): Promise<AgentQLExtractResult> {
        const extractionType = params.url ? 'URL' : 'HTML';
        const startTime = Date.now();
        
        try {
            if (!process.env.AGENTQL_API_KEY) {
                throw new Error('AGENTQL_API_KEY environment variable is not set');
            }

            logger.info(`Starting AgentQL extraction for ${extractionType} with timeout: ${AgentQLService.DEFAULT_TIMEOUT}ms`);

            const requestBody = {
                query: AgentQLService.AGENTQL_QUERY,
                ...(params.url && { url: params.url }),
                ...(params.html && { html: params.html }),
                params: {
                    ...(params.waitFor && { wait_for: params.waitFor }),
                    ...(params.scrollToBottom && { is_scroll_to_bottom_enabled: params.scrollToBottom }),
                    mode: params.mode || "standard"
                }
            };

            const response = await fetchWithTimeout(AgentQLService.API_ENDPOINT, {
                headers: {
                    'X-API-Key': process.env.AGENTQL_API_KEY,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
                timeout: AgentQLService.DEFAULT_TIMEOUT,
                retries: 2, // Add retry capability
                data: JSON.stringify(requestBody)
            });

            const duration = Date.now() - startTime;
            logger.info(`AgentQL extraction completed for ${extractionType} in ${duration}ms`);

            const data = response.data || {};
            const result = {
                postContent: data.article_content || '',
                readMoreUrl: data.same_article_continuation_links || [],
                isHumanVerificationRequired: data.verification_required || false
            };

            // Log extraction quality metrics
            if (result.postContent) {
                logger.info(`Extracted content length: ${result.postContent.length} characters, Read more links: ${result.readMoreUrl.length}`);
            } else {
                logger.warn(`AgentQL extraction returned empty content for ${extractionType}`);
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`AgentQL extraction failed for ${extractionType} after ${duration}ms:`, {
                error: error instanceof Error ? error.message : String(error),
                extractionType,
                timeout: AgentQLService.DEFAULT_TIMEOUT,
                hasUrl: !!params.url,
                hasHtml: !!params.html
            });

            // Return empty result instead of throwing to allow graceful degradation
            return {
                postContent: '',
                readMoreUrl: [],
                isHumanVerificationRequired: false
            };
        }
    }
}

export default new AgentQLService();