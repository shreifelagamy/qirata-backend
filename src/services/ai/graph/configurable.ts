import { AuthenticatedSocket } from '../../../types/socket.types';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import { SocialPostsService } from '../../social-posts.service';
import { MessagesService } from '../../messages.service';
import { PostsService } from '../../posts.service';

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
