import { IPostProcessor, PostProcessorContext, PostProcessorResult } from './base.post-processor';
import { ChatGraphState } from '../state';
import { SocialPostsService } from '../../../social-posts.service';
import { SocialPlatform } from '../../../../entities/social-post.entity';
import { logger } from '../../../../utils/logger';

/**
 * Post-processor for handling social post edits.
 * Updates the existing social post in the database.
 */
export class SocialPostEditPostProcessor implements IPostProcessor {
    private socialPostsService = new SocialPostsService();

    canHandle(result: typeof ChatGraphState.State): boolean {
        return !!(
            result.isSocialPost &&
            result.structuredPost &&
            result.editingSocialPostId // This is an edit operation
        );
    }

    async process(context: PostProcessorContext): Promise<PostProcessorResult> {
        const { result, sessionId, userId } = context;

        logger.info('[PostProcessor: SocialPostEdit] Updating social post:', {
            postId: result.editingSocialPostId
        });

        // Convert lowercase platform to SocialPlatform enum (if platform changed)
        const platformEnum = result.platformResult?.platform === 'twitter'
            ? SocialPlatform.TWITTER
            : SocialPlatform.LINKEDIN;

        // Transform structured post to match service interface
        const updateData = {
            content: result.structuredPost!.postContent,
            platform: platformEnum,
            code_examples: result.structuredPost!.codeExamples || [],
            visual_elements: result.structuredPost!.visualElements || []
        };

        // Update social post in database
        const updatedSocialPost = await this.socialPostsService.update(
            sessionId,
            result.editingSocialPostId!,
            userId,
            updateData
        );

        logger.info('[PostProcessor: SocialPostEdit] Social post updated:', {
            id: updatedSocialPost.id,
            platform: updatedSocialPost.platform
        });

        return {
            socialPostId: updatedSocialPost.id,
            response: result.response || '',
            suggestedOptions: result.suggestedOptions || [],
            isSocialPost: true,
            structuredPost: result.structuredPost
        };
    }
}
