import { AuthenticatedSocket } from '../../../../types/socket.types';
import { ChatGraphState } from '../state';

/**
 * Base interface for all post-processors.
 * Each post-processor handles a specific type of graph result.
 */
export interface PostProcessorResult {
    socialPostId?: string;
    response: string;
    suggestedOptions: string[];
    isSocialPost: boolean;
    structuredPost?: any;
}

export interface PostProcessorContext {
    result: typeof ChatGraphState.State;
    sessionId: string;
    userId: string;
    postId?: string;
    message: string;
    emit: (event: string, data: any) => void;
}

export interface IPostProcessor {
    /**
     * Check if this processor can handle the given result
     */
    canHandle(result: typeof ChatGraphState.State): boolean;

    /**
     * Process the graph result and perform side effects (DB saves, etc.)
     */
    process(context: PostProcessorContext): Promise<PostProcessorResult>;
}
