import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { BaseNode, ChatState } from './base-node';
import { AIStreamCallback } from '../../../../types/ai.types';
import { handleQuestion } from '../../agents/question-handler.agent';

class WebSocketStreamCallback extends BaseCallbackHandler {
    name = 'websocket_stream_callback';

    constructor(
        private sessionId: string,
        private streamCallback: AIStreamCallback
    ) {
        super();
    }

    async handleLLMStart(): Promise<void> {
        this.streamCallback({
            event: 'start',
            sessionId: this.sessionId
        });
    }

    async handleLLMNewToken(token: string): Promise<void> {
        this.streamCallback({
            event: 'token',
            token,
            sessionId: this.sessionId
        });
    }

    async handleLLMEnd(): Promise<void> {
        this.streamCallback({
            event: 'end',
            sessionId: this.sessionId
        });
    }

    async handleLLMError(error: Error): Promise<void> {
        this.streamCallback({
            event: 'error',
            error: error.message,
            sessionId: this.sessionId
        });
    }
}

export class QuestionHandlerNode extends BaseNode {

    constructor() {
        super('QuestionHandler');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Handling question', state.sessionId);

            if (!state.models?.questionHandler) {
                throw new Error('Question handler model not available in state');
            }

            // Get conversation history from previous messages
            const conversationHistory = state.previousMessages || [];

            // Prepare streaming callbacks if available
            const streamingCallbacks = state.callback ? [
                new WebSocketStreamCallback(state.sessionId, state.callback)
            ] : [];

            const response = await handleQuestion({
                model: state.models.questionHandler,
                userMessage: state.userMessage,
                conversationHistory,
                postContent: state.postContent,
                conversationSummary: state.conversationSummary,
                streamingCallbacks
            });

            const tokenCount = this.estimateTokenCount(state.userMessage + response);

            return {
                aiResponse: response,
                responseType: 'question_answer',
                tokenCount
            };
        } catch (error) {
            this.logError('Question handling error', error, state.sessionId);
            return this.handleError('Question handling', error);
        }
    }
}