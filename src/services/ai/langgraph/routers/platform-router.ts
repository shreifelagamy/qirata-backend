import { ChatState } from '../nodes/base-node';

export class PlatformRouter {
    static routeByPlatform(state: ChatState): string {
        if (state.error) return "platform_clarification";
        return state.platformDetection?.needsClarification ? 'platform_clarification' : 'social_post_generator';
    }
}