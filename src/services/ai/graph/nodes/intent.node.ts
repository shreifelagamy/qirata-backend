import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { intentAgent } from '../../agents';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';

/**
 * Intent Detection Node
 *
 * Classifies the user's intent using the intentAgent and updates the graph state
 * with the detected intent, confidence, reasoning, and optional clarifying question.
 */
export async function detectIntentNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: IntentNode] Starting intent detection");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Detecting your intent...'
    });

    // Extract context from state
    const { message, lastMessages, lastIntent } = state;

    // Call the intent agent with conversation context
    const result = await intentAgent({
        message,
        lastMessages: lastMessages,
        lastIntent
    });

    logger.info('[NODE: IntentNode] Intent detected:', {
        intent: result.intent,
        confidence: result.confidence,
        reasoning: result.reasoning
    });

    return {
        intentResult: result
    };
}
