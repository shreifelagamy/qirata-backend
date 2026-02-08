import { task } from '@langchain/langgraph';
import { z } from 'zod';
import platformAgent from '../agents/platform.agent';
import { MemoryStateType, TaskOutput } from './types';

export const platformTask = task('platform', async (
    params: { message: string },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    const agent = await platformAgent({
        message: params.message,
        lastMessages: memory.lastMessages.map(msg => msg.user_message) || []
    });

    return {
        response: {
            message: agent.message,
            suggestedOptions: agent.suggestedOptions,
            needsSocialClarification: agent.needsClarification
        },
        contextUpdates: agent.platform ? {
            // Store detected platform in memory for future use
            detectedPlatform: agent.platform
        } : undefined
    };
});