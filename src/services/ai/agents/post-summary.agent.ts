import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from "@langchain/ollama";
import { logger } from "../../../utils/logger";

type SummarizeOptions = {
    model?: ChatOllama;
    postContent: string;
}

const POST_SUMMARY_PROMPT = `
Analyze and summarize the following post content to create a concise context for future AI conversations:

<POST_CONTENT>
{post_content}
</POST_CONTENT>

Extract and summarize:
1. Main topic/theme of the post
2. Key points or arguments presented
3. Industry/domain context (business, tech, lifestyle, etc.)
4. Tone and style (professional, casual, educational, opinion, etc.)
5. Target audience implications
6. Any specific platforms or contexts mentioned
7. Notable hashtags, mentions, or keywords
8. Content type (announcement, question, advice, news, personal experience, etc.)

Create a concise 3-4 sentence summary that captures the essence of the post for conversation context. This summary will be used to help AI understand what users are discussing in relation to this post.

Focus on actionable context that helps future conversations be more relevant and personalized.

Summary:`;

export async function summarizePost(options: SummarizeOptions): Promise<string> {
    const {
        model = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'mistral:7b', temperature: 0.7 }),
        postContent
    } = options;

    if (!postContent || postContent.trim().length === 0) {
        logger.warn('Empty post content provided for summarization');
        return 'No post content available for context.';
    }

    try {
        logger.info('Generating post summary for context');

        const prompt = ChatPromptTemplate.fromTemplate(POST_SUMMARY_PROMPT);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        const summary = await chain.invoke({
            post_content: postContent.trim()
        });

        logger.info('Post summary generated successfully');
        return summary;

    } catch (error) {
        logger.error('Failed to generate post summary:', error);
        return `Post content available but summary failed. Content preview: ${postContent.substring(0, 100)}...`;
    }
}