import { handleQuestion } from '../../agents/question-handler.agent';
import { BaseNode, ChatState } from './base-node';

export class QuestionHandlerNode extends BaseNode {

    constructor() {
        super('QuestionHandler');
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Handling question', state.sessionId);

            // Get conversation history from previous messages
            const conversationHistory = state.previousMessages || [];

            if (state.callback) {
                state.callback({
                    event: 'start',
                    sessionId: state.sessionId,
                    message: 'Starting question processing...'
                });
            }

            const stream = await handleQuestion({
                userMessage: state.userMessage,
                conversationHistory,
                postContent: state.postContent,
                conversationSummary: state.conversationSummary
            });

            let finalResponse = '';

            for await (const chunk of stream) {
                if (state.callback) {
                    state.callback({
                        event: 'token',
                        token: chunk,
                        sessionId: state.sessionId
                    });
                }

                finalResponse += chunk;
            }

            if (state.callback) {
                state.callback({
                    event: 'end',
                    sessionId: state.sessionId
                });
            }

            const tokenCount = this.estimateTokenCount(state.userMessage + finalResponse);

            return {
                aiResponse: finalResponse,
                responseType: 'question_answer',
                isSocialPost: false,
                tokenCount
            };
        } catch (error) {
            this.logError('Question handling error', error, state.sessionId);
            return this.handleError('Question handling', error);
        }
    }
}