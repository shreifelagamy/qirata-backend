import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Platform Router
 *
 * Routes based on platform detection results:
 * - If platform is detected with confidence → proceed to social post generation
 * - If platform needs clarification → ask user for platform choice
 */
export function socialIntentRouter(state: typeof ChatGraphState.State): string {
    const socialIntentResult = state.socialIntentResult;

    if (!socialIntentResult) {
        console.warn('⚠️ [SocialIntentRouter] No social intent result found, ending.');
        return END;
    }

    console.log(`🔀 [SocialIntentRouter] Social Intent: ${socialIntentResult}`);

    switch (socialIntentResult) {
        case 'CREATE':
            return 'SocialPlatformClarification';

        case 'EDIT':
            return 'SocialPostSelector';

        default:
            return END;
    }
}
