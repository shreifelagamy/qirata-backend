import { entrypoint } from '@langchain/langgraph';
import { AuthenticatedSocket } from '../../../types/socket.types';
import { MessagesService } from '../../messages.service';
import { SocialPostsService } from '../../social-posts.service';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import {
    intentTask,
    platformTask,
    postQATask,
    socialPostEditTask,
    socialPostTask,
    supportTask
} from '../tasks';
import { MemoryStateType } from '../tasks/types';

interface WorkflowParams {
    message: string;
    socket: AuthenticatedSocket;
    sessionId: string;
    userId: string;
    emit: (event: string, data: any) => void;
}

interface WorkflowResult {
    response: string;
    suggestedOptions: string[];
    isSocialPost: boolean;
    socialPostId?: string;
    structuredPost: {
        postContent: string;
        codeExamples: Array<{
            language: string;
            code: string;
            description?: string | null;
        }> | null;
        visualElements: Array<{
            type: string;
            description: string;
            content: string;
            style: string;
        }> | null;
    } | null;
}

interface SocialPostContext {
    platform: string;
    content: string;
    id: string;
    createdAt: Date;
    publishedAt?: Date;
}

/**
 * Qirata Chat Workflow Class
 * Handles the entire AI conversation flow using LangGraph Functional API
 * Manages memory, emits events, and orchestrates all tasks
 */
export class QirataChatWorkflow {
    private socketMemoryService = new SocketMemoryService();
    private socialPostsService = new SocialPostsService();
    private messagesService = new MessagesService();
    private workflow: any;

    /**
     * Start the workflow - main entry point
     */
    async start(params: WorkflowParams): Promise<WorkflowResult> {
        const { message, socket, sessionId, userId } = params;

        // Ensure memory is available
        const memory = await this.socketMemoryService.ensureMemory({ socket, sessionId, userId });

        const workflow = entrypoint({
            name: "QirataFlow"
        }, this.executeWorkflow.bind(this));

        // Execute the workflow
        return await workflow.invoke({
            message,
            memory,
            socket,
            sessionId,
            userId,
            emit: params.emit
        }, {
            configurable: {
                thread_id: sessionId,
                session_id: sessionId
            },
            signal: socket.data.activeStreams?.get(sessionId)?.signal
        });
    }

    /**
     * Main workflow execution logic
     */
    private async executeWorkflow(input: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        userId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit } = input;

        // Start the workflow
        emit('chat:stream:start', {
            sessionId,
            intentType: 'Processing your request...'
        });

        // Detect intent
        const { response: intentResponse } = await intentTask({ message }, memory);
        console.log('Intent detected:', intentResponse);

        // Route to appropriate handler based on intent
        let result: WorkflowResult;

        switch (intentResponse.intent) {
            case 'GENERAL':
                result = await this.handleGeneralSupport({ message, memory, socket, sessionId, emit });
                break;

            case 'ASK_POST':
                result = await this.handlePostQuestion({ message, memory, socket, sessionId, emit });
                break;

            case 'REQ_SOCIAL_POST':
                result = await this.handleSocialPostRequest({ message, memory, socket, sessionId, emit });
                break;

            case 'EDIT_SOCIAL_POST':
                result = await this.handleSocialPostEdit({ message, memory, socket, sessionId, emit });
                break;

            case 'CLARIFY_INTENT':
                result = await this.handleIntentClarification({ message, memory, socket, sessionId, emit, intentResponse });
                break;

            default:
                result = await this.handleUnknownIntent({ message, memory, socket, sessionId, emit });
                break;
        }

        // Update last intent in socket memory cache
        this.socketMemoryService.updateContext({
            socket,
            sessionId,
            updates: { lastIntent: intentResponse.intent }
        });

        return result;
    }

    /**
     * Handle general support requests
     */
    private async handleGeneralSupport(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit } = params;

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: 'Providing general support...'
        });

        // Execute support task
        const { response: supportResponse } = await supportTask({ message }, memory);

        // Save message to memory and database (non-blocking)
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: supportResponse.message!
        });

        // Return result
        const result = {
            response: supportResponse.message!,
            suggestedOptions: supportResponse.suggestedOptions || [],
            isSocialPost: false,
            structuredPost: null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Handle post-related questions
     */
    private async handlePostQuestion(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit } = params;

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: 'Analyzing your question about the post...'
        });

        // Execute post Q&A task
        const { response: qaResponse, contextUpdates } = await postQATask({ message }, memory);

        // Save message to memory and database (non-blocking)
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: qaResponse.message!
        });

        // Update context if needed
        if (contextUpdates) {
            this.socketMemoryService.updateContext({
                socket,
                sessionId,
                updates: contextUpdates
            });
        }

        // Return result
        const result = {
            response: qaResponse.message!,
            suggestedOptions: qaResponse.suggestedOptions || [],
            isSocialPost: false,
            structuredPost: null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Handle social media post generation requests
     */
    private async handleSocialPostRequest(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit } = params;

        // Step 1: Detect platform
        emit('chat:stream:token', {
            sessionId,
            token: 'Detecting target platform...'
        });

        const { response: platformResponse, contextUpdates: platformContextUpdates } = await platformTask({ message }, memory);

        // Step 2: Handle platform detection result
        if (platformContextUpdates?.detectedPlatform) {
            return await this.generateSocialPost({
                message,
                memory,
                socket,
                sessionId,
                emit,
                platformResponse,
                platformContextUpdates
            });
        } else {
            return await this.requestPlatformClarification({
                message,
                socket,
                sessionId,
                emit,
                platformResponse,
                memory
            });
        }
    }

    /**
     * Generate social media post when platform is detected
     */
    private async generateSocialPost(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
        platformResponse: any;
        platformContextUpdates: any;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit, platformContextUpdates } = params;

        // Update memory with detected platform
        const updatedMemory = this.socketMemoryService.updateContext({
            socket,
            sessionId,
            updates: platformContextUpdates
        });

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: `Platform detected: ${platformContextUpdates.detectedPlatform}. Creating content...`
        });

        // Generate social post
        const { response: socialPostResponse, contextUpdates: socialPostContextUpdates } = await socialPostTask({ message }, updatedMemory);

        // Save generated social post to database first to get the ID
        let socialPostId: string | undefined;
        if (socialPostResponse.structuredPost) {
            try {
                const savedPost = await this.socialPostsService.upsert(sessionId, memory.userId, {
                    content: socialPostResponse.structuredPost.postContent,
                    platform: platformContextUpdates.detectedPlatform,
                    image_urls: [],
                    code_examples: socialPostResponse.structuredPost.codeExamples || [],
                    visual_elements: socialPostResponse.structuredPost.visualElements || []
                });

                socialPostId = savedPost.id;
                console.log(`💾 [Workflow] Saved social post ${savedPost.id} to database`);

                // Invalidate cache after successful save
                this.socketMemoryService.invalidateSocialPostsCache({ socket, sessionId });

            } catch (error) {
                console.error('❌ [Workflow] Error saving social post to database:', error);
                // Continue execution - don't block the user experience
            }
        }

        // Update memory with social post context if needed
        if (socialPostContextUpdates) {
            this.socketMemoryService.updateContext({
                socket,
                sessionId,
                updates: socialPostContextUpdates
            });
        }

        // Save message with social post reference
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: socialPostResponse.message!,
            socialPostId
        });

        // Return result
        const result: WorkflowResult = {
            response: socialPostResponse.message!,
            suggestedOptions: socialPostResponse.suggestedOptions || [],
            isSocialPost: true,
            socialPostId,
            structuredPost: socialPostResponse.structuredPost ? {
                postContent: socialPostResponse.structuredPost.postContent,
                codeExamples: socialPostResponse.structuredPost.codeExamples || null,
                visualElements: socialPostResponse.structuredPost.visualElements || null
            } : null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Request platform clarification when platform is not detected
     */
    private async requestPlatformClarification(params: {
        message: string;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
        platformResponse: any;
        memory: MemoryStateType;
    }): Promise<WorkflowResult> {
        const { message, socket, sessionId, emit, platformResponse, memory } = params;

        // Save platform clarification message to memory and database (non-blocking)
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: platformResponse.message!
        });

        // Return clarification result
        const result = {
            response: platformResponse.message!,
            suggestedOptions: platformResponse.suggestedOptions || [],
            isSocialPost: false,
            structuredPost: null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Handle social media post edit requests
     */
    private async handleSocialPostEdit(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit } = params;

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: 'Analyzing edit request...'
        });

        // Get existing social posts from session context using cached method
        const socialPosts = await this.socketMemoryService.getSocialPosts({ socket, sessionId, userId: memory.userId });

        if (!socialPosts || socialPosts.length === 0) {
            // No posts to edit
            const result = {
                response: "I couldn't find any social posts to edit in this session. Would you like to create a new social media post instead?",
                suggestedOptions: ['Create a new social media post', 'Ask about content'],
                isSocialPost: false,
                structuredPost: null
            };

            this.emitCompletion(sessionId, result, emit);
            return result;
        }

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: 'Editing social media post...'
        });

        // Use the dedicated social post edit task
        const { response: socialPostResponse, contextUpdates: socialPostContextUpdates } = await socialPostEditTask(
            {
                message,
                socialPosts: socialPosts.map(post => ({
                    ...post,
                    publishedAt: post.publishedAt || null // Convert undefined to null
                }))
            },
            memory
        );

        // Save edited social post to database first to capture the ID
        let socialPostId: string | undefined = socialPostResponse.socialPostId;
        if (socialPostResponse.structuredPost && socialPostResponse.socialPostId) {
            try {
                const updatedPost = await this.socialPostsService.update(
                    sessionId,
                    socialPostResponse.socialPostId,
                    memory.userId,
                    {
                        content: socialPostResponse.structuredPost.postContent,
                        image_urls: [],
                        code_examples: socialPostResponse.structuredPost.codeExamples || [],
                        visual_elements: socialPostResponse.structuredPost.visualElements || []
                    }
                );
                socialPostId = updatedPost.id;
                console.log(`💾 [Workflow] Updated social post ${updatedPost.id} in database`);

                // Invalidate cache after successful save
                this.socketMemoryService.invalidateSocialPostsCache({ socket, sessionId });

            } catch (error) {
                console.error('❌ [Workflow] Error updating social post in database:', error);
                // Continue execution - don't block the user experience
            }
        }

        // Update memory with any context updates
        if (socialPostContextUpdates) {
            this.socketMemoryService.updateContext({
                socket,
                sessionId,
                updates: socialPostContextUpdates
            });
        }

        // Save message with social post reference
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: socialPostResponse.message!,
            socialPostId
        });

        // Return result
        const result: WorkflowResult = {
            response: socialPostResponse.message!,
            suggestedOptions: socialPostResponse.suggestedOptions || [],
            isSocialPost: true,
            socialPostId,
            structuredPost: socialPostResponse.structuredPost ? {
                postContent: socialPostResponse.structuredPost.postContent,
                codeExamples: socialPostResponse.structuredPost.codeExamples || null,
                visualElements: socialPostResponse.structuredPost.visualElements || null
            } : null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }


    /**
     * Handle intent clarification requests
     */
    private async handleIntentClarification(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
        intentResponse: any;
    }): Promise<WorkflowResult> {
        const { message, memory, socket, sessionId, emit, intentResponse } = params;

        // Emit progress
        emit('chat:stream:token', {
            sessionId,
            token: 'Understanding your request...'
        });

        // Save clarification message to memory and database (non-blocking)
        this.saveMessage({
            socket,
            sessionId,
            userId: memory.userId,
            userMessage: message,
            aiResponse: intentResponse.clarifyingQuestion || "I need more information to help you properly."
        });

        // Use the clarifying question and suggested options from the intent agent
        const clarifyingQuestion = intentResponse.clarifyingQuestion ||
            "I'm not sure exactly what you'd like me to help with. Could you be more specific?";

        // Use agent-provided suggested options, or fall back to generic ones
        const suggestedOptions = intentResponse.suggestedOptions || [
            "Ask about content",
            "Create social post",
            "Edit existing post"
        ];

        const result = {
            response: clarifyingQuestion,
            suggestedOptions,
            isSocialPost: false,
            structuredPost: null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Handle unknown intents
     */
    private async handleUnknownIntent(params: {
        message: string;
        memory: MemoryStateType;
        socket: AuthenticatedSocket;
        sessionId: string;
        emit: (event: string, data: any) => void;
    }): Promise<WorkflowResult> {
        const { sessionId, emit } = params;

        const result = {
            response: "I'm not sure how to help with that. Could you please clarify your request?",
            suggestedOptions: ['Ask a question about the post', 'Create social media content'],
            isSocialPost: false,
            structuredPost: null
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Save message to both memory and database (fire-and-forget)
     */
    private async saveMessage(params: {
        socket: AuthenticatedSocket;
        sessionId: string;
        userId: string;
        userMessage: string;
        aiResponse: string;
        socialPostId?: string;
    }): Promise<void> {
        const { socket, sessionId, userId, userMessage, aiResponse, socialPostId } = params;

        try {
            // Update memory cache
            this.socketMemoryService.addMessage({
                socket,
                sessionId,
                userMessage,
                aiResponse
            });

            // Save to database with optional social post reference
            this.messagesService.saveMessage(sessionId, userId, userMessage, aiResponse, socialPostId);

            console.log(`💾 [Workflow] Saved message to database for session ${sessionId}${socialPostId ? ` (social_post: ${socialPostId})` : ''}`);

        } catch (error) {
            console.error('❌ [Workflow] Error saving message to database:', error);
            // Continue execution - don't block user experience
        }
    }

    /**
     * Emit completion event with final response
     */
    private emitCompletion(sessionId: string, result: WorkflowResult, emit: (event: string, data: any) => void): void {
        emit('chat:stream:end', {
            sessionId,
            message: 'Process completed',
            response: result.response,
            suggestedOptions: result.suggestedOptions,
            isSocialPost: result.isSocialPost,
            socialPostId: result.socialPostId,
            structuredPost: result.structuredPost || null
        });
    }
}