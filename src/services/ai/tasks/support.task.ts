import { task } from '@langchain/langgraph';
import { z } from 'zod';
import { supportAgent } from '../agents/support.agent';
import { MemoryStateType, TaskOutput } from './types';

export const supportTask = task('support', async (
    params: { message: string },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    const agent = await supportAgent({
        message: params.message,
        lastMessages: memory.lastMessages.map(msg => msg.user_message) || [],
        postTitle: memory.currentPostId ? 'Post Available' : 'No Post',
        postSummary: memory.postSummary
    });

    return {
        response: {
            message: agent.response,
            suggestedOptions: agent.suggestedOptions
        },
    }
});