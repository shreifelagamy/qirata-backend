import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Intent Router
 *
 * Routes to the appropriate node based on detected intent.
 */
export function intentRouter(state: typeof ChatGraphState.State): string {
    const intentResult = state.intentResult;

    if (!intentResult) {
        console.warn('⚠️ [IntentRouter] No intent result found, ending.');
        return END;
    }

    console.log(`🔀 [IntentRouter] Routing based on intent: ${intentResult.intent}`);

    switch (intentResult.intent) {
        case 'SUPPORT':
            return 'Support';

        case 'ASK_POST':
            return 'PostQA';

        case 'SOCIAL':
            return 'SocialIntent';

        default:
            console.warn(`⚠️ [IntentRouter] Unhandled intent: ${intentResult.intent}, ending.`);
            return END;
    }
}
