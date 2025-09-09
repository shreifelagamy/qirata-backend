import { entrypoint } from '@langchain/langgraph';
import { AuthenticatedSocket } from '../../../types/socket.types';
import { SocketMemoryService } from '../../websocket/socket-memory.service';
import {
    intentTask,
    platformTask,
    postQATask,
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
}

/**
 * Qirata Chat Workflow Class
 * Handles the entire AI conversation flow using LangGraph Functional API
 * Manages memory, emits events, and orchestrates all tasks
 */
export class QirataChatWorkflow {
    private socketMemoryService = new SocketMemoryService();
    private workflow: any;

    constructor() {
        // Initialize the LangGraph workflow
        this.workflow = entrypoint({
            name: "QirataFlow"
        }, this.executeWorkflow.bind(this));
    }

    /**
     * Start the workflow - main entry point
     */
    async start(params: WorkflowParams): Promise<WorkflowResult> {
        const { message, socket, sessionId, userId } = params;

        // Ensure memory is available
        const memory = await this.socketMemoryService.ensureMemory({ socket, sessionId, userId });

        // Execute the workflow
        return await this.workflow.invoke({
            message,
            memory,
            socket,
            sessionId,
            userId,
            emit: params.emit
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
        console.log('Intent detected:', intentResponse.intent);

        // Route to appropriate handler based on intent
        switch (intentResponse.intent) {
            case 'GENERAL':
                return await this.handleGeneralSupport({ message, memory, socket, sessionId, emit });

            case 'ASK_POST':
                return await this.handlePostQuestion({ message, memory, socket, sessionId, emit });

            case 'REQ_SOCIAL_POST':
                return await this.handleSocialPostRequest({ message, memory, socket, sessionId, emit });

            default:
                return await this.handleUnknownIntent({ message, memory, socket, sessionId, emit });
        }
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

        // Update memory
        this.socketMemoryService.addMessage({
            socket,
            sessionId,
            userMessage: message,
            aiResponse: supportResponse.message!
        });

        // Return result
        const result = {
            response: supportResponse.message!,
            suggestedOptions: supportResponse.suggestedOptions || []
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

        // Update memory with message
        this.socketMemoryService.addMessage({
            socket,
            sessionId,
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
            suggestedOptions: qaResponse.suggestedOptions || []
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
                platformResponse
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

        // Update memory with social post context if needed
        if (socialPostContextUpdates) {
            this.socketMemoryService.updateContext({
                socket,
                sessionId,
                updates: socialPostContextUpdates
            });
        }

        // Add message to memory
        this.socketMemoryService.addMessage({
            socket,
            sessionId,
            userMessage: message,
            aiResponse: socialPostResponse.message!
        });

        // Return result
        const result = {
            response: socialPostResponse.message!,
            suggestedOptions: socialPostResponse.suggestedOptions || []
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
    }): Promise<WorkflowResult> {
        const { message, socket, sessionId, emit, platformResponse } = params;

        // Add platform clarification to memory
        this.socketMemoryService.addMessage({
            socket,
            sessionId,
            userMessage: message,
            aiResponse: platformResponse.message!
        });

        // Return clarification result
        const result = {
            response: platformResponse.message!,
            suggestedOptions: platformResponse.suggestedOptions || []
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
            suggestedOptions: ['Ask a question about the post', 'Create social media content']
        };

        this.emitCompletion(sessionId, result, emit);
        return result;
    }

    /**
     * Emit completion event with final response
     */
    private emitCompletion(sessionId: string, result: WorkflowResult, emit: (event: string, data: any) => void): void {
        emit('chat:stream:end', {
            sessionId,
            message: 'Process completed',
            response: result.response,
            suggestedOptions: result.suggestedOptions
        });
    }
}