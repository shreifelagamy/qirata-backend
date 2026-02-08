import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Platform Router
 * 
 * Routes based on platform detection results:
 * - If platform is detected with confidence → proceed to social post generation
 * - If platform needs clarification → ask user for platform choice
 */
export function platformRouter(state: typeof ChatGraphState.State): string {
    const platformResult = state.platformResult;

    if (!platformResult) {
        console.warn('⚠️ [PlatformRouter] No platform result found, ending.');
        return END;
    }

    console.log(`🔀 [PlatformRouter] Platform: ${platformResult.platform}, Needs clarification: ${platformResult.needsClarification}`);

    // If platform needs clarification, route to clarification node
    if (platformResult.needsClarification) {
        return 'platformClarification';
    }

    // If platform is detected, route to social post generation
    if (platformResult.platform) {
        console.log('✅ [PlatformRouter] Platform detected, routing to socialPost');
        return 'socialPost';
    }

    // Fallback: if no platform and no clarification needed (shouldn't happen)
    console.warn('⚠️ [PlatformRouter] Unexpected state - no platform and no clarification needed');
    return END;
}
