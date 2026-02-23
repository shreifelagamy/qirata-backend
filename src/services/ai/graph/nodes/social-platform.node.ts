import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { socialPlatformAgent } from '../../agents';
import { ChatGraphState, ChatGraphUpdateType } from '../state';
import { ChatGraphConfigurable } from '../configurable';

/**
 * Platform Clarification Node
 *
 * Pure formatting node that sets the response when platform detection needs clarification.
 * This is called when the platform agent determines it needs user input to identify
 * the target platform (Twitter vs LinkedIn).
 */
export async function socialPlatformNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: SocialPlatformNode] Formatting social platform detection response");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Detecting target platform...'
    });

    const { lastMessages, message } = state;

    // Call the platform agent with conversation context
    const result = await socialPlatformAgent({
        message,
        lastMessages: lastMessages.map(msg => msg.user_message)
    });

    logger.info('[NODE: SocialPlatformNode] Platform detection result:', {
        platform: result.platform,
    });

    // Return state update with grouped platformResult
    return {
        socialPlatformResult: result.platform,
        response: result.message || undefined,
        suggestedOptions: result.suggestedOptions || undefined
    };
}
