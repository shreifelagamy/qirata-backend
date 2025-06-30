import { BaseNode, ChatState } from './base-node';
import { MemoryService } from '../../memory.service';

export class UpdateMemoryNode extends BaseNode {
    private memoryService: MemoryService;

    constructor(memoryService: MemoryService) {
        super('UpdateMemory');
        this.memoryService = memoryService;
    }

    async execute(state: ChatState): Promise<Partial<ChatState>> {
        try {
            this.logInfo('Updating memory', state.sessionId);

            if (state.aiResponse) {
                await this.memoryService.saveContext(
                    state.sessionId,
                    state.userMessage,
                    state.aiResponse
                );
            }

            const finalProcessingTime = Date.now() - (state.processingTime || Date.now());

            return {
                processingTime: finalProcessingTime
            };
        } catch (error) {
            this.logError('Memory update error', error, state.sessionId);
            return this.handleError('Memory update', error);
        }
    }
}