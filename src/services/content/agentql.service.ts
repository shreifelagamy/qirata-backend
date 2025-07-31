import { fetchWithTimeout } from "../../utils/http.util";

export class AgentQLService {
    async extract(url: string): Promise<{ postContent: string, readMoreUrl: string[] }> {
        const response = await fetchWithTimeout('https://api.agentql.com/v1/query-data', {
            headers: {
                'X-API-Key': process.env.AGENTQL_API_KEY || '',
                'Content-Type': 'application/json',
            },
            method: 'POST',
            timeout: 20000, // 20 seconds timeout for AgentQL requests
            data: JSON.stringify({
                query: `{
                    post_content(post content, including images url in markdown)
                    read_more_link(links included within the topic, read more links and not register links)[]
                }`,
                url: url,
                params: {
                    wait_for: 2,
                    is_scroll_to_bottom_enabled: true
                }
            })
        });

        console.log('AgentQL response:', response);

        // Parse the response and extract the data
        const data = response.data || {};

        return {
            postContent: data.post_content || '',
            readMoreUrl: data.read_more_link || []
        };
    }
}