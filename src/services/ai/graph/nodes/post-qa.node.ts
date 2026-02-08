import { RunnableConfig } from '@langchain/core/runnables';
import { postQAAgent } from '../../agents/post-qa.agent';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';
import { logger } from '../../../../utils/logger';

/**
 * Post Q&A Node
 *
 * Answers user questions about the current post using the postQAAgent.
 * Uses post content directly from state (no extra fetch).
 */
export async function postQANode(
    state: typeof ChatGraphState.State,
    config: RunnableConfig
): Promise<ChatGraphUpdateType> {
    logger.info('[NODE: PostQANode] Handling post question');

    const configurable = config.configurable as ChatGraphConfigurable | undefined;
    const post = state.post;

    // Emit progress
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Analyzing the post and your question...'
    });

    const qaResult = await postQAAgent({
        message: state.message,
        lastMessages: state.lastMessages,
        postSummary: post?.summary || '',
        conversationSummary: undefined,
        postContent: post?.content || ''
    });

    return {
        response: qaResult.response,
        suggestedOptions: qaResult.suggestedOptions,
        isSocialPost: false
    };
}
