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

    private static readonly DEFAULT_TIMEOUT = 20000;
    private static readonly API_ENDPOINT = 'https://api.agentql.com/v1/query-data';

    async extract(url: string): Promise<AgentQLExtractResult> {
        return this.performExtraction({
            url,
            waitFor: 2,
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
        try {
            if (!process.env.AGENTQL_API_KEY) {
                throw new Error('AGENTQL_API_KEY environment variable is not set');
            }

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
                data: JSON.stringify(requestBody)
            });

            logger.info(`AgentQL extraction completed for ${params.url ? 'URL' : 'HTML'}`);

            const data = response.data || {};
            return {
                postContent: data.article_content || '',
                readMoreUrl: data.same_article_continuation_links || [],
                isHumanVerificationRequired: data.verification_required || false
            };
        } catch (error) {
            logger.error('AgentQL extraction failed:', error);

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