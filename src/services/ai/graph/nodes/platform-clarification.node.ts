import { RunnableConfig } from '@langchain/core/runnables';
import { ChatGraphState, ChatGraphUpdateType } from '../state';
import { logger } from '../../../../utils/logger';

/**
 * Platform Clarification Node
 *
 * Pure formatting node that sets the response when platform detection needs clarification.
 * This is called when the platform agent determines it needs user input to identify
 * the target platform (Twitter vs LinkedIn).
 */
export async function platformClarificationNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: PlatformClarificationNode] Formatting platform clarification response");

    const { platformResult } = state;

    if (!platformResult?.clarificationMessage) {
        logger.warn('[NODE: PlatformClarificationNode] No clarification message found');
        return {
            response: 'Which platform would you like to create content for?',
            isSocialPost: false,
            error: undefined
        };
    }

    // Return the clarification message with suggested options
    return {
        response: platformResult.clarificationMessage,
        isSocialPost: false,
        // suggestedOptions already set by platform node
        error: undefined
    };
}
