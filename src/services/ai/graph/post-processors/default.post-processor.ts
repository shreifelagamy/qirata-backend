import { IPostProcessor, PostProcessorContext, PostProcessorResult } from './base.post-processor';
import { ChatGraphState } from '../state';
import { logger } from '../../../../utils/logger';

/**
 * Default post-processor for regular Q&A responses.
 * Handles any graph result that doesn't match specialized processors.
 * Simply passes through the response without additional side effects.
 */
export class DefaultPostProcessor implements IPostProcessor {
    canHandle(result: typeof ChatGraphState.State): boolean {
        // This is the fallback processor - always returns true
        // Should be checked last in the processor chain
        return true;
    }

    async process(context: PostProcessorContext): Promise<PostProcessorResult> {
        const { result } = context;

        logger.info('[PostProcessor: Default] Processing standard response');

        return {
            response: result.response || "I'm not sure how to help with that.",
            suggestedOptions: result.suggestedOptions || [],
            isSocialPost: false
        };
    }
}
