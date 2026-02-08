import { RunnableConfig } from '@langchain/core/runnables';
import { supportAgent } from '../../agents/support.agent';
import { ChatGraphState, ChatGraphUpdateType } from '../state';
import { logger } from '../../../../utils/logger';
import { ChatGraphConfigurable } from '../configurable';

/**
 * Support Node
 *
 * Handles general conversation and support requests using the supportAgent.
 * Provides friendly responses and suggested actions.
 */
export async function supportNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info('[NODE: SupportNode] Handling general support request');

    // Extract context from state
    const { message, lastMessages, post } = state;
    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Generating a helpful response...'
    });

    // Call the support agent with conversation context and post title
    const result = await supportAgent({
        message,
        lastMessages: lastMessages.map(msg => msg.user_message),
        postTitle: post!.title,
        postSummary: post?.summary,
    });

    logger.info('[NODE: SupportNode] Support response generated');

    // Return state update with response
    return {
        response: result.response,
        suggestedOptions: result.suggestedOptions,
        isSocialPost: false,
    };
}
