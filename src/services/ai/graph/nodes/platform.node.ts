import { RunnableConfig } from '@langchain/core/runnables';
import { platformAgent } from '../../agents';
import { ChatGraphState, ChatGraphUpdateType } from '../state';
import { logger } from '../../../../utils/logger';
import { ChatGraphConfigurable } from '../configurable';

/**
 * Platform Detection Node
 *
 * Detects the target social media platform (Twitter or LinkedIn) from the user's message.
 * Updates the graph state with platform detection results including confidence and
 * whether clarification is needed.
 */
export async function platformNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: PlatformNode] Starting platform detection");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Detecting target platform...'
    });

    // Extract context from state
    const { message, lastMessages } = state;

    // Call the platform agent with conversation context
    const result = await platformAgent({
        message,
        lastMessages: lastMessages.map(msg => msg.user_message)
    });

    logger.info('[NODE: PlatformNode] Platform detection result:', {
        platform: result.platform,
        confidence: result.confidence,
        needsClarification: result.needsClarification
    });

    // Return state update with grouped platformResult
    return {
        platformResult: {
            platform: result.platform,
            confidence: result.confidence,
            needsClarification: result.needsClarification,
            clarificationMessage: result.message
        },
        // Also set suggestedOptions if clarification is needed
        suggestedOptions: result.needsClarification ? result.suggestedOptions : undefined
    };
}
