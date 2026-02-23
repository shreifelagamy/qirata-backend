import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { socialPostSelectorAgent } from '../../agents';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';

/**
 * Social Post Selector Node
 *
 * Determines which social post the user wants to edit from the available posts.
 * If it can identify the post, sets editingSocialPostId and routes to the edit node.
 * If it can't determine, returns suggested options asking the user to select.
 */
export async function socialPostSelectorNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: SocialPostSelectorNode] Selecting social post to edit");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Identifying which post to edit...'
    });

    const { message, lastMessages, socialPostsHistory } = state;

    // If no posts exist, return early
    if (!socialPostsHistory || socialPostsHistory.length === 0) {
        return {
            response: 'No social posts found in this session. Create a post first before trying to edit.',
            isSocialPost: false,
        };
    }

    // Call the social post selector agent
    const result = await socialPostSelectorAgent({
        message,
        lastMessages,
        socialPostsHistory,
    });

    logger.info('[NODE: SocialPostSelectorNode] Post selection result:', {
        selectedPostId: result.selectedPostId,
        confidence: result.confidence,
        reasoning: result.reasoning,
    });

    // Post identified → set the ID for the edit node
    if (result.selectedPostId) {
        return {
            editingSocialPostId: result.selectedPostId,
        };
    }

    // Post not identified → ask the user to select
    return {
        response: result.message,
        suggestedOptions: result.suggestedOptions,
    };
}
