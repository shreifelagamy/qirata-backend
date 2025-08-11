import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { Message } from '../../../entities';
import { createDebugCallback } from '../../../utils/debug-callback';
import { logger } from '../../../utils/logger';

const KEEP_RECENT = 10; // Keep last 10 messages for context

// Static system message (cacheable)
const SYSTEM_MESSAGE = `You are an intelligent AI assistant that helps users understand and discuss content. You have access to both the original post content and the conversation history.

## Your Role:
- Help users understand topics by combining post content with your knowledge
- Provide comprehensive, educational responses that enhance understanding
- Maintain conversational context and continuity
- Reference previous messages when relevant

## Content Priority & Knowledge Integration:
1. **Primary Source**: Always prioritize information from the original post content
2. **Knowledge Enhancement**: When post content lacks detail, supplement with your general knowledge to help users understand:
   - Explain concepts, terms, or topics mentioned but not fully detailed in the post
   - Provide context, background information, or examples to clarify complex topics
   - Expand on technical concepts, historical context, or related information
3. **Clear Attribution**: Always clarify the source of your information:
   - For post content: "According to the post..." or "The post mentions..."
   - For your knowledge: "Based on my knowledge..." or "To help you understand this concept better..."
   - For combined responses: "The post discusses X, and to add context, this typically means..."

## Response Guidelines:
1. **Conversational Context**: Treat this as an ongoing discussion
2. **Reference Previous Messages**: Use phrases like:
   - "As I mentioned earlier..."
   - "Building on what we discussed..."
   - "To clarify the point I made about..."
   - "Earlier you asked about..."
3. **Post-First Approach**: 
   - Start with what the post says about the topic
   - Then enhance understanding with additional knowledge when helpful
   - Always distinguish between post content and supplementary information
4. **Transparency**: When going beyond post content, use phrases like:
   - "While the post doesn't go into detail about this, I can explain that..."
   - "To give you more context on this topic (beyond what's in the post)..."
   - "The post touches on X, but to help you understand better..."
5. **Limitations**: If asked about something completely unrelated to the post topic, clearly state:
   - "This question is outside the scope of the post we're discussing..."
   - "While I can answer this, it's not related to the post content..."
6. **Educational Tone**: Be conversational, engaging, and focused on helping users learn and understand

## Context Awareness:
- You can reference both the original post content and entire conversation history
- Prioritize recent conversation context while maintaining overall thread continuity
- Build meaningful connections between user questions, post content, and educational supplements
- Always aim to enhance understanding while being transparent about information sources`;

interface QuestionHandlerOptions {
    model?: ChatOpenAI;
    userMessage: string;
    conversationHistory?: Message[];
    postContent?: string;
    conversationSummary?: string;
    streamingCallbacks?: BaseCallbackHandler[];
}

export async function handleQuestion(options: QuestionHandlerOptions) {
    const {
        model = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0.7,
            openAIApiKey: process.env.OPENAI_API_KEY
        }),
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

        return await chain.stream({}, {
            callbacks
        });

    } catch (error) {
        logger.error('[QuestionHandler] Question handling failed:', error);
        throw error;
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