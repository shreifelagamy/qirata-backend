import { IPostProcessor, PostProcessorContext, PostProcessorResult } from './base.post-processor';
import { SocialPostCreatePostProcessor } from './social-post-create.post-processor';
import { SocialPostEditPostProcessor } from './social-post-edit.post-processor';
import { DefaultPostProcessor } from './default.post-processor';
import { logger } from '../../../../utils/logger';

/**
 * Post-Processor Manager
 * 
 * Uses the Chain of Responsibility pattern to find the appropriate
 * post-processor for a given graph result and execute it.
 * 
 * Order matters - processors are checked in sequence until one
 * returns true from canHandle(). The DefaultPostProcessor should
 * always be last as it handles everything.
 */
export class PostProcessorManager {
    private processors: IPostProcessor[];

    constructor() {
        // Order matters! Most specific processors first, default last
        this.processors = [
            new SocialPostEditPostProcessor(),
            new SocialPostCreatePostProcessor(),
            new DefaultPostProcessor() // Fallback - always last
        ];
    }

    /**
     * Process the graph result by finding the appropriate processor
     * and executing it.
     */
    async process(context: PostProcessorContext): Promise<PostProcessorResult> {
        const { result } = context;

        logger.info('[PostProcessorManager] Finding appropriate processor for result type');

        // Find the first processor that can handle this result
        const processor = this.processors.find(p => p.canHandle(result));

        if (!processor) {
            logger.error('[PostProcessorManager] No processor found! This should never happen.');
            throw new Error('No post-processor found for graph result');
        }

        logger.info(`[PostProcessorManager] Using processor: ${processor.constructor.name}`);

        // Execute the processor
        return await processor.process(context);
    }

    /**
     * Register a custom post-processor.
     * Useful for adding domain-specific processors without modifying this class.
     * 
     * @param processor - The processor to register
     * @param position - Optional position in the chain (default: before DefaultPostProcessor)
     */
    registerProcessor(processor: IPostProcessor, position?: number): void {
        if (position !== undefined) {
            this.processors.splice(position, 0, processor);
        } else {
            // Insert before the last processor (DefaultPostProcessor)
            this.processors.splice(this.processors.length - 1, 0, processor);
        }

        logger.info(`[PostProcessorManager] Registered custom processor: ${processor.constructor.name}`);
    }
}
