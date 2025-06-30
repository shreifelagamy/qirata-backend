import { BaseNode, ChatState } from './base-node';
import { AIContext } from '../../../../types/ai.types';
import { MemoryService } from '../../memory.service';

export class LoadContentNode extends BaseNode {
    private memoryService: MemoryService;

    constructor(memoryService: MemoryService) {
        super('LoadContent');
        this.memoryService = memoryService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Loading context', state.sessionId);

            const memory = await this.memoryService.getOrCreateMemory(
                state.sessionId,
                state.previousMessages || [],
                state.conversationSummary
            );

            const context: AIContext = {
                postContent: state.postContent,
                previousMessages: state.previousMessages,
                conversationSummary: state.conversationSummary,
                userPreferences: state.userPreferences
            };

            return {
                memory,
                context,
                processingTime: Date.now()
            };
        } catch (error) {
            this.logError('Context loading error', error, state.sessionId);
            return this.handleError('Context loading', error);
        }
    }
}