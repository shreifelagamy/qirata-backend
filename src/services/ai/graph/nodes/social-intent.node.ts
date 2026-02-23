import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { socialIntentAgent } from '../../agents';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';

/**
 * Social Intent Node
 *
 * Determines the social intent (CREATE or EDIT) for a user's message.
 * Uses conversation context and previous messages to classify intent.
 */
export async function socialIntentNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: SocialIntentNode] Determining the social intent");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Determining social intent...'
    });

    // Extract context from state
    const { message, lastMessages } = state;

    // Call the social intent agent
    const result = await socialIntentAgent({
        message,
        lastMessages
    });

    logger.info('[NODE: SocialIntentNode] Social intent determined:', {
        action: result.action,
        confidence: result.confidence,
        reasoning: result.reasoning
    });

    // Return state update with the generated post
    return {
        socialIntentResult: result.action
    };
}
