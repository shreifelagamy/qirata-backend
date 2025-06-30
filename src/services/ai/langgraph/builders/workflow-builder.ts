import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { ChatState } from '../nodes/base-node';
import { LoadContentNode } from '../nodes/load-content-node';
import { IntentDetectionNode } from '../nodes/intent-detection-node';
import { PlatformDetectionNode } from '../nodes/platform-detection-node';
import { PlatformClarificationNode } from '../nodes/platform-clarification-node';
import { QuestionHandlerNode } from '../nodes/question-handler-node';
import { SocialPostGeneratorNode } from '../nodes/social-post-generator-node';
import { UpdateMemoryNode } from '../nodes/update-memory-node';
import { IntentRouter } from '../routers/intent-router';
import { PlatformRouter } from '../routers/platform-router';
import { IntentDetectionService } from '../../intent-detection.service';
import { SocialPostGeneratorService } from '../../social-post-generator.service';
import { PlatformDetectionService } from '../../platform-detection.service';
import { MemoryService } from '../../memory.service';
import { AIContext, AIStreamCallback, UserIntent } from '../../../../types/ai.types';
import { SocialPlatform } from '../../../../entities/social-post.entity';
import { PlatformDetectionResult } from '../../platform-detection.service';

const ChatStateAnnotation = Annotation.Root({
    // Input
    sessionId: Annotation<string>(),
    userMessage: Annotation<string>(),
    postContent: Annotation<string>(),
    previousMessages: Annotation<any[]>(),
    conversationSummary: Annotation<string>(),
    userPreferences: Annotation<any>(),
    callback: Annotation<AIStreamCallback>(),

    // Processing State
    memory: Annotation<any>(),
    context: Annotation<AIContext>(),
    intent: Annotation<UserIntent>(),
    confidence: Annotation<number>(),
    platformDetection: Annotation<PlatformDetectionResult>(),
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
    private chatModel: ChatOllama;
    
    // Services
    private intentService: IntentDetectionService;
    private socialPostGeneratorService: SocialPostGeneratorService;
    private platformDetectionService: PlatformDetectionService;
    private memoryService: MemoryService;
    
    // Nodes
    private loadContentNode!: LoadContentNode;
    private intentDetectionNode!: IntentDetectionNode;
    private platformDetectionNode!: PlatformDetectionNode;
    private platformClarificationNode!: PlatformClarificationNode;
    private questionHandlerNode!: QuestionHandlerNode;
    private socialPostGeneratorNode!: SocialPostGeneratorNode;
    private updateMemoryNode!: UpdateMemoryNode;

    constructor(
        chatModel: ChatOllama,
        intentService: IntentDetectionService,
        socialPostGeneratorService: SocialPostGeneratorService,
        platformDetectionService: PlatformDetectionService,
        memoryService: MemoryService
    ) {
        this.memorySaver = new MemorySaver();
        this.chatModel = chatModel;
        this.intentService = intentService;
        this.socialPostGeneratorService = socialPostGeneratorService;
        this.platformDetectionService = platformDetectionService;
        this.memoryService = memoryService;

        this.initializeNodes();
    }

    private initializeNodes(): void {
        this.loadContentNode = new LoadContentNode(this.memoryService);
        this.intentDetectionNode = new IntentDetectionNode(this.intentService);
        this.platformDetectionNode = new PlatformDetectionNode(this.platformDetectionService);
        this.platformClarificationNode = new PlatformClarificationNode(this.platformDetectionService);
        this.questionHandlerNode = new QuestionHandlerNode(this.chatModel);
        this.socialPostGeneratorNode = new SocialPostGeneratorNode(this.chatModel, this.socialPostGeneratorService);
        this.updateMemoryNode = new UpdateMemoryNode(this.memoryService);
    }

    public buildWorkflow(): any {
        const workflow = new StateGraph(ChatStateAnnotation)
            .addNode("load_content", this.loadContentNode.execute.bind(this.loadContentNode))
            .addNode("intent_detection", this.intentDetectionNode.execute.bind(this.intentDetectionNode))
            .addNode("platform_detection", this.platformDetectionNode.execute.bind(this.platformDetectionNode))
            .addNode("platform_clarification", this.platformClarificationNode.execute.bind(this.platformClarificationNode))
            .addNode("social_post_generator", this.socialPostGeneratorNode.execute.bind(this.socialPostGeneratorNode))
            .addNode("question_handler", this.questionHandlerNode.execute.bind(this.questionHandlerNode))
            .addNode("update_memory", this.updateMemoryNode.execute.bind(this.updateMemoryNode))
            .addEdge("load_content", "intent_detection")
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
            .addEdge("social_post_generator", "update_memory")
            .addEdge("question_handler", "update_memory")
            .addEdge(START, "load_content")
            .addEdge("update_memory", END)
            .addEdge("platform_clarification", END);

        return workflow.compile({ checkpointer: this.memorySaver });
    }
}