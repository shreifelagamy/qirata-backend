import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Intent Router
 * 
 * Routes to the appropriate node based on detected intent.
 * For now, we only handle GENERAL intent.
 */
export function intentRouter(state: typeof ChatGraphState.State): string {
    const intentResult = state.intentResult;

    if (!intentResult) {
        console.warn('⚠️ [IntentRouter] No intent result found, ending.');
        return END;
    }

    console.log(`🔀 [IntentRouter] Routing based on intent: ${intentResult.type}`);

    switch (intentResult.type) {
        case 'GENERAL':
            return 'support';

        case 'ASK_POST':
            return 'postQA';
        // TODO: Add other intents as we implement them
        // case 'REQ_SOCIAL_POST':
        //     return 'platform';
        // case 'EDIT_SOCIAL_POST':
        //     return 'socialPostEdit';
        // case 'CLARIFY_INTENT':
        //     return 'clarify';

        default:
            console.warn(`⚠️ [IntentRouter] Unhandled intent: ${intentResult.type}, ending.`);
            return END;
    }
}
