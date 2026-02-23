import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { socialPostEditAgent } from '../../agents';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';

/**
 * Social Post Edit Node
 *
 * Edits an existing social media post using the social post edit agent.
 * Expects `editingSocialPostId` to be set by the SocialPostSelector node.
 * Finds the target post from `socialPostsHistory` in state and passes it to the edit agent.
 */
export async function socialPostEditNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: SocialPostEditNode] Starting social post edit");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Editing social media post...'
    });

    const {
        message,
        lastMessages,
        post,
        socialMediaContentPreferences,
        socialPostsHistory,
        editingSocialPostId
    } = state;

    // editingSocialPostId should be set by the SocialPostSelector node
    if (!editingSocialPostId) {
        logger.error('[NODE: SocialPostEditNode] No editingSocialPostId set');
        return {
            response: 'Could not determine which post to edit. Please try again.',
            isSocialPost: false,
        };
    }

    // Find the target post from state's socialPostsHistory
    const targetPost = socialPostsHistory?.find(sp => sp.id === editingSocialPostId);
    if (!targetPost) {
        logger.error('[NODE: SocialPostEditNode] Post not found in socialPostsHistory:', { editingSocialPostId });
        return {
            response: 'The selected post could not be found. It may have been deleted.',
            isSocialPost: false,
        };
    }

    logger.info('[NODE: SocialPostEditNode] Target post found:', {
        postId: targetPost.id,
        platform: targetPost.platform,
    });

    // Call the social post edit agent
    const result = await socialPostEditAgent({
        message,
        lastMessages,
        targetSocialPost: {
            id: targetPost.id,
            platform: targetPost.platform,
            content: targetPost.content,
            codeExamples: targetPost.codeExamples || null,
        },
        postContent: post?.content || null,
        socialMediaContentPreferences: socialMediaContentPreferences || null
    });

    logger.info('[NODE: SocialPostEditNode] Social post edited:', {
        postId: targetPost.id,
        platform: targetPost.platform,
        hasCodeExamples: !!result.structuredPost.codeExamples?.length,
        hasVisualElements: !!result.structuredPost.visualElements?.length,
        postLength: result.structuredPost.postContent.length
    });

    return {
        response: result.message,
        suggestedOptions: result.suggestedOptions,
        isSocialPost: true,
        structuredPost: result.structuredPost,
        editingSocialPostId,
    };
}
