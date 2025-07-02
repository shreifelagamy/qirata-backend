import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { SocialPlatform } from '../../../../entities/social-post.entity';
import { AIContext, AIStreamCallback } from '../../../../types/ai.types';
import { DEFAULT_MODEL_CONFIGS, WorkflowModelConfigs, WorkflowModels, createWorkflowModels } from '../../../../types/model-config.types';
import { IntentDetectionResponse } from '../../agents/intent-detection.agent';
import { PlatformDetectionResponse } from '../../agents/platform-detection.agent';
import {
    ConversationSummaryNode,
    IntentDetectionNode,
    PlatformClarificationNode,
    PlatformDetectionNode,
    QuestionHandlerNode,
    SocialPostGeneratorNode
} from '../nodes';
import { IntentRouter, PlatformRouter } from '../routers';

const ChatStateAnnotation = Annotation.Root({
    // Input
    sessionId: Annotation<string>(),
    userMessage: Annotation<string>(),
    postContent: Annotation<string>(),
    postSummary: Annotation<string>(),
    previousMessages: Annotation<any[]>(),
    conversationSummary: Annotation<string>(),
    userPreferences: Annotation<any>(),
    callback: Annotation<AIStreamCallback>(),

    // Model Configuration
    models: Annotation<WorkflowModels>(),

    // Processing State
    memory: Annotation<any>(),
    context: Annotation<AIContext>(),
    intent: Annotation<IntentDetectionResponse>(),
    platformDetection: Annotation<PlatformDetectionResponse>(),
    needsPlatformClarification: Annotation<boolean>(),
    waitingForPlatformChoice: Annotation<boolean>(),

    // Output
    aiResponse: Annotation<string>(),
    responseType: Annotation<'question_answer' | 'social_post' | 'platform_clarification'>(),
    socialPlatform: Annotation<SocialPlatform>(),
    isSocialPost: Annotation<boolean>(),
    error: Annotation<string>(),
    tokenCount: Annotation<number>(),
    processingTime: Annotation<number>(),
});

export class WorkflowBuilder {
    private memorySaver: MemorySaver;
    private modelConfigs: WorkflowModelConfigs;
    private workflowModels: WorkflowModels;

    // Nodes
    private conversationSummaryNode!: ConversationSummaryNode;
    private intentDetectionNode!: IntentDetectionNode;
    private platformDetectionNode!: PlatformDetectionNode;
    private platformClarificationNode!: PlatformClarificationNode;
    private questionHandlerNode!: QuestionHandlerNode;
    private socialPostGeneratorNode!: SocialPostGeneratorNode;

    constructor(modelConfigs: WorkflowModelConfigs = DEFAULT_MODEL_CONFIGS) {
        this.memorySaver = new MemorySaver();
        this.modelConfigs = modelConfigs;
        this.workflowModels = createWorkflowModels(modelConfigs);

        // Only social post generator doesn't use models directly

        this.initializeNodes();
    }

    private initializeNodes(): void {
        this.conversationSummaryNode = new ConversationSummaryNode();
        this.intentDetectionNode = new IntentDetectionNode();
        this.platformDetectionNode = new PlatformDetectionNode();
        this.platformClarificationNode = new PlatformClarificationNode();
        this.questionHandlerNode = new QuestionHandlerNode();
        this.socialPostGeneratorNode = new SocialPostGeneratorNode();
    }

    /**
     * Inject models into the workflow state
     */
    private async injectModels(state: any): Promise<Partial<any>> {
        return {
            models: this.workflowModels
        };
    }

    public buildWorkflow(): any {
        const workflow = new StateGraph(ChatStateAnnotation)
            .addNode("inject_models", this.injectModels.bind(this))
            .addNode("conversation_summary", this.conversationSummaryNode.execute.bind(this.conversationSummaryNode))
            .addNode("intent_detection", this.intentDetectionNode.execute.bind(this.intentDetectionNode))
            .addNode("platform_detection", this.platformDetectionNode.execute.bind(this.platformDetectionNode))
            .addNode("platform_clarification", this.platformClarificationNode.execute.bind(this.platformClarificationNode))
            .addNode("social_post_generator", this.socialPostGeneratorNode.execute.bind(this.socialPostGeneratorNode))
            .addNode("question_handler", this.questionHandlerNode.execute.bind(this.questionHandlerNode))
            .addEdge("inject_models", "conversation_summary")
            .addEdge("conversation_summary", "intent_detection")
            // Intent Router - route based on detected intent
            .addConditionalEdges(
                "intent_detection",
                IntentRouter.routeByIntent,
                {
                    "platform_detection": "platform_detection",
                    "question_handler": "question_handler"
                }
            )
            // Platform Router - route based on platform detection
            .addConditionalEdges(
                "platform_detection",
                PlatformRouter.routeByPlatform,
                {
                    "platform_clarification": "platform_clarification",
                    "social_post_generator": "social_post_generator"
                }
            )
            .addEdge("social_post_generator", END)
            .addEdge("question_handler", END)
            .addEdge(START, "inject_models")
            .addEdge("platform_clarification", END);

        return workflow.compile({ checkpointer: this.memorySaver });
    }
}