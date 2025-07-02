import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import { Message } from '../../../entities';
import { DEFAULT_MODEL_CONFIGS, createModelFromConfig } from '../../../types/model-config.types';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

const KEEP_RECENT = 10; // Keep last 10 messages for context

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an intelligent AI assistant that helps users understand and discuss content. You have access to both the original post content and the conversation history.

## Your Role:
- Answer questions based on the post content AND conversation history
- Provide helpful, accurate, and relevant responses
- Maintain conversational context and continuity
- Reference previous messages when relevant

## Response Guidelines:
1. **Conversational Context**: Treat this as an ongoing discussion
2. **Reference Previous Messages**: Use phrases like:
   - "As I mentioned earlier..."
   - "Building on what we discussed..."
   - "To clarify the point I made about..."
   - "Earlier you asked about..."
3. **Post Content Integration**: Always consider the original post when answering
4. **Clarification**: If user asks about "the previous message" or "what you said before", refer to chat history
5. **Limitations**: If asked about something not covered in post or conversation, clearly state that
6. **Helpful Tone**: Be conversational, engaging, and educational

## Context Awareness:
- You can reference both the original post content and entire conversation history
- Prioritize recent conversation context while maintaining overall thread continuity
- Build meaningful connections between user questions and available content`;

interface QuestionHandlerOptions {
    model?: ChatOllama;
    userMessage: string;
    conversationHistory?: Message[];
    postContent?: string;
    conversationSummary?: string;
    streamingCallbacks?: BaseCallbackHandler[];
}

export async function handleQuestion(options: QuestionHandlerOptions): Promise<string> {
    const {
        model = createModelFromConfig(DEFAULT_MODEL_CONFIGS.questionHandler),
        userMessage,
        conversationHistory,
        postContent,
        conversationSummary,
        streamingCallbacks
    } = options;

    try {
        logger.info('Handling question with AI');

        // Build messages array with conversation history
        const messages = buildMessagesArray(
            conversationHistory || [],
            userMessage,
            postContent,
            conversationSummary
        );

        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        // Prepare callbacks - include debug callback and streaming callbacks
        const callbacks: BaseCallbackHandler[] = [createDebugCallback('question-handler')];
        if (streamingCallbacks) {
            callbacks.push(...streamingCallbacks);
        }

        const response = await chain.invoke({}, {
            callbacks
        });

        logger.info('Question handled successfully');
        return response;

    } catch (error) {
        logger.error('[QuestionHandler] Question handling failed:', error);
        return 'I apologize, but I encountered an error while processing your question. Please try asking again.';
    }
}

// Helper function to build messages array for prompt
function buildMessagesArray(
    conversationHistory: Message[],
    currentUserMessage: string,
    postContent?: string,
    conversationSummary?: string
): BaseMessage[] {
    const messages: BaseMessage[] = [];

    // Static system message (cacheable)
    messages.push(new SystemMessage(SYSTEM_MESSAGE));

    // Add post content as context if available
    if (postContent?.trim()) {
        messages.push(new HumanMessage(`<ORIGINAL_POST>\n${postContent}\n</ORIGINAL_POST>`));
        messages.push(new AIMessage('I understand. I have the post content and will reference it when answering your questions.'));
    }

    // Add conversation summary if available
    if (conversationSummary?.trim()) {
        messages.push(new HumanMessage(`<CONVERSATION_SUMMARY>\n${conversationSummary}\n</CONVERSATION_SUMMARY>`));
        messages.push(new AIMessage('I have the conversation summary and will maintain context from our previous discussion.'));
    }

    // Add recent conversation history as separate messages
    const recentMessages = conversationHistory.slice(-KEEP_RECENT);

    for (const msg of recentMessages) {
        if (msg.user_message?.trim()) {
            messages.push(new HumanMessage(msg.user_message));
        }
        if (msg.ai_response?.trim()) {
            messages.push(new AIMessage(msg.ai_response));
        }
    }

    // Current user message
    messages.push(new HumanMessage(currentUserMessage));

    return messages;
}