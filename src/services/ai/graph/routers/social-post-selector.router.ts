import { END } from '@langchain/langgraph';
import { ChatGraphState } from '../state';

/**
 * Social Post Selector Router
 *
 * Routes based on post selection results:
 * - If a post was identified (editingSocialPostId is set) → proceed to SocialPostEdit
 * - If no post was identified (needs user input) → END (response with suggested options already set)
 */
export function socialPostSelectorRouter(state: typeof ChatGraphState.State): string {
    const { editingSocialPostId } = state;

    if (editingSocialPostId) {
        console.log(`🔀 [SocialPostSelectorRouter] Post selected: ${editingSocialPostId}, routing to edit`);
        return 'SocialPostEdit';
    }

    console.log('🔀 [SocialPostSelectorRouter] No post selected, asking user to choose');
    return END;
}
