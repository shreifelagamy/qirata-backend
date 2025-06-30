import { ChatOllama } from "@langchain/ollama";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { Message } from "../../entities";
import { AISessionMemory } from "../../types/ai.types";
import { logger } from '../../utils/logger';

export class MemoryService {
    private sessionMemories = new Map<string, AISessionMemory>();
    private chatModel: ChatOllama;
    private memoryTokenLimit: number;

    constructor(chatModel: ChatOllama) {
        this.chatModel = chatModel;
        this.memoryTokenLimit = parseInt(process.env.AI_MEMORY_TOKEN_LIMIT || '1000');
    }

    async getOrCreateMemory(
        sessionId: string,
        recentMessages: Message[] = [],
        sessionSummary?: string
    ): Promise<ConversationSummaryBufferMemory> {
        let sessionMemory = this.sessionMemories.get(sessionId);

        if (!sessionMemory) {
            // build session memory
            const memory = new ConversationSummaryBufferMemory({
                llm: this.chatModel,
                maxTokenLimit: this.memoryTokenLimit,
                returnMessages: true,
                memoryKey: 'chatHistory'
            })

            // Restore summary if provided
            if (sessionSummary) {
                memory.movingSummaryBuffer = sessionSummary;
                logger.debug(`Restored summary for session ${sessionId}`);
            }

            // Load messages ONLY if array is not empty
            if (recentMessages && recentMessages.length > 0) {
                for (const message of recentMessages) {
                    await memory.saveContext(
                        { input: message.user_message },
                        { output: message.ai_response }
                    );
                }
                logger.info(`Loaded ${recentMessages.length} messages into memory`);
            } else {
                logger.info(`Created fresh memory for session ${sessionId} (no previous messages)`);
            }

            // Token count handles empty array correctly
            const tokenCount = recentMessages.length > 0
                ? this.estimateTokenCount(
                    recentMessages.map(m => m.user_message + m.ai_response).join(' ')
                )
                : 0;

            sessionMemory = {
                sessionId,
                memory,
                lastActivity: new Date(),
                tokenCount
            };

            this.sessionMemories.set(sessionId, sessionMemory);
        } else {
            sessionMemory.lastActivity
        }

        return sessionMemory.memory;
    }

    private estimateTokenCount(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }

    async saveContext(sessionId: string, input: string, output: string): Promise<void> {
        const memory = this.sessionMemories.get(sessionId);
        if (!memory) return;

        await memory.memory.saveContext({ input }, { output });
        memory.tokenCount += this.estimateTokenCount(input + output);
        memory.lastActivity = new Date();
    }

    getMovingSummary(sessionId: string): string | undefined {
        return this.sessionMemories.get(sessionId)?.memory.movingSummaryBuffer;
    }

    clearMemory(sessionId: string): void {
        this.sessionMemories.delete(sessionId);
    }

    cleanupInactiveSessions(thresholdMinutes: number = 30): void {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - (thresholdMinutes * 60 * 1000));

        let cleanedCount = 0;

        for (const [sessionId, sessionMemory] of this.sessionMemories.entries()) {
            if (sessionMemory.lastActivity < cutoffTime) {
                this.clearMemory(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} inactive session memories`);
        }
    }
}