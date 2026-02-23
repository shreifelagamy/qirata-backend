import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Platform Router
 *
 * Routes based on platform detection results:
 * - If platform is detected with confidence → proceed to social post generation
 * - If platform needs clarification → ask user for platform choice
 */
export function socialPlatformRouter(state: typeof ChatGraphState.State): string {
    const socialPlatformResult = state.socialPlatformResult;

    if (!socialPlatformResult) {
        console.warn('⚠️ [SocialPlatformRouter] No social platform result found, ending.');
        return END;
    }

    return 'SocialPostCreate';
}
