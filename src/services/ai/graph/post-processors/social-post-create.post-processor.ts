import { IPostProcessor, PostProcessorContext, PostProcessorResult } from './base.post-processor';
import { ChatGraphState } from '../state';
import { SocialPostsService } from '../../../social-posts.service';
import { SocialPlatform } from '../../../../entities/social-post.entity';
import { logger } from '../../../../utils/logger';

/**
 * Post-processor for handling new social post creation.
 * Saves the generated social post to the database.
 */
export class SocialPostCreatePostProcessor implements IPostProcessor {
    private socialPostsService = new SocialPostsService();

    canHandle(result: typeof ChatGraphState.State): boolean {
        return !!(
            result.isSocialPost &&
            result.structuredPost &&
            result.platformResult?.platform &&
            !result.editingSocialPostId // Not an edit operation
        );
    }

    async process(context: PostProcessorContext): Promise<PostProcessorResult> {
        const { result, sessionId, userId, postId } = context;

        logger.info('[PostProcessor: SocialPostCreate] Creating new social post');

        // Convert lowercase platform to SocialPlatform enum
        const platformEnum = result.platformResult!.platform === 'twitter'
            ? SocialPlatform.TWITTER
            : SocialPlatform.LINKEDIN;

        // Transform structured post to match service interface
        const socialPostData = {
            content: result.structuredPost!.postContent,
            platform: platformEnum,
            code_examples: result.structuredPost!.codeExamples || [],
            visual_elements: result.structuredPost!.visualElements || []
        };

        // Create social post in database
        const savedSocialPost = await this.socialPostsService.create(
            sessionId,
            userId,
            postId!,
            socialPostData
        );

        logger.info('[PostProcessor: SocialPostCreate] Social post created:', {
            id: savedSocialPost.id,
            platform: savedSocialPost.platform
        });

        return {
            socialPostId: savedSocialPost.id,
            response: result.response || '',
            suggestedOptions: result.suggestedOptions || [],
            isSocialPost: true,
            structuredPost: result.structuredPost
        };
    }
}
