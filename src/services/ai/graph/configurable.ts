import { AuthenticatedSocket } from '../../../types/socket.types';
import { SocialPostsService } from '../../domain/social-posts.service';
import { MessagesService } from '../../domain/messages.service';
import { PostsService } from '../../domain/posts.service';

/**
 * Type for services and external dependencies passed to graph nodes
 * via the `configurable` prop in LangGraph.
 * Uses `type` instead of `interface` so it satisfies Record<string, any> index signature.
 */
export type ChatGraphConfigurable = {
    // Session context
    thread_id: string;
    session_id: string;

    emit: (event: string, data: any) => void;
};
