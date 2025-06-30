import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { BaseNode, ChatState } from './base-node';
import { AIStreamCallback } from '../../../../types/ai.types';

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
    private chatModel: ChatOllama;
    private readonly QUESTION_SYSTEM_PROMPT = `You are an intelligent AI assistant that helps users understand and discuss content. You have access to both the original post content and the conversation history. Use this context to provide helpful, accurate, and relevant responses.

## Post Content:
{postContent}

## Previous Conversation Summary:
{conversationSummary}

## Instructions:
- Answer questions based on the post content AND the conversation history
- Reference previous messages when relevant (e.g., "As I mentioned earlier...", "Building on what we discussed...")
- If the user asks about "the previous message" or "what you said before", refer to the chat history
- If the user asks for explanations about points from previous responses, provide detailed clarifications
- If the user asks about something not covered in either the post or conversation, clearly state that
- Maintain conversational context and continuity
- Be conversational and helpful, treating this as an ongoing discussion

## Examples of conversational responses:
- "Earlier I mentioned X, let me elaborate on that..."
- "Building on our previous discussion about Y..."
- "To clarify the point I made about Z..."
- "As we discussed, the main idea is..."

Remember: You can reference both the original post content and our entire conversation history to provide contextual, meaningful responses.`;

    constructor(chatModel: ChatOllama) {
        super('QuestionHandler');
        this.chatModel = chatModel;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Handling question', state.sessionId);

            const prompt = ChatPromptTemplate.fromMessages([
                ['system', this.QUESTION_SYSTEM_PROMPT],
                new MessagesPlaceholder('chatHistory'),
                ['human', '{userMessage}']
            ]);

            const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

            const chatHistory = state.memory ? await state.memory.chatHistory.getMessages() : [];

            const callbacks = state.callback ? [
                new WebSocketStreamCallback(state.sessionId, state.callback)
            ] : [];

            const response = await chain.invoke({
                userMessage: state.userMessage,
                postContent: state.context?.postContent || 'No post content provided',
                conversationSummary: state.context?.conversationSummary || '',
                chatHistory
            }, { callbacks });

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