import { ChatState } from '../nodes/base-node';

export class IntentRouter {
    static routeByIntent(state: ChatState): 'platform_detection' | 'question_handler' {
        if (state.error) return "question_handler";
        return state.intent?.intent === 'social' ? 'platform_detection' : 'question_handler';
    }
}