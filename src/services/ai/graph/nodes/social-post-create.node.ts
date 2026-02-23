import { RunnableConfig } from '@langchain/core/runnables';
import { logger } from '../../../../utils/logger';
import { socialPostCreateAgent } from '../../agents';
import { ChatGraphConfigurable } from '../configurable';
import { ChatGraphState, ChatGraphUpdateType } from '../state';

/**
 * Social Post Generation Node
 *
 * Generates new social media posts using the social post create agent.
 * Uses the detected platform, post content, conversation context, and user preferences
 * to create engaging platform-optimized content.
 */
export async function socialPostCreateNode(state: typeof ChatGraphState.State, config: RunnableConfig): Promise<ChatGraphUpdateType> {
    logger.info("[NODE: SocialPostCreateNode] Starting social post generation");

    const configurable = config.configurable as ChatGraphConfigurable | undefined;

    // Emit a progress event
    configurable?.emit('chat:stream:token', {
        sessionId: configurable?.session_id,
        token: 'Generating social media post...'
    });

    // Extract context from state
    const {
        message,
        lastMessages,
        post,
        socialPlatformResult,
        socialMediaContentPreferences
    } = state;

    // Platform should be detected at this point
    const platform = socialPlatformResult;
    if (!platform) {
        logger.error('[NODE: SocialPostCreateNode] No platform detected');
        return {
            response: 'I need to know which platform to create content for. Please specify Twitter or LinkedIn.',
            isSocialPost: false,
            error: 'No platform detected'
        };
    }

    // Post content should be available
    const postContent = post?.content;
    if (!postContent) {
        logger.error('[NODE: SocialPostCreateNode] No post content available');
        return {
            response: 'I need article content to create a social post from. Please select an article first.',
            isSocialPost: false,
            error: 'No post content available'
        };
    }

    // Call the social post create agent
    const result = await socialPostCreateAgent({
        message,
        lastMessages,
        postContent,
        platform,
        socialMediaContentPreferences: socialMediaContentPreferences || null
    });

    logger.info('[NODE: SocialPostNode] Social post generated:', {
        platform,
        hasCodeExamples: !!result.structuredPost.codeExamples?.length,
        hasVisualElements: !!result.structuredPost.visualElements?.length,
        postLength: result.structuredPost.postContent.length
    });

    // Return state update with the generated post
    return {
        response: result.message,
        isSocialPost: true,
        structuredPost: result.structuredPost,
        error: undefined
    };
}
