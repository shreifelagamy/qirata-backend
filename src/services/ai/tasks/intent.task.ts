import { task } from '@langchain/langgraph';
import { z } from 'zod';
import { intentAgent, IntentRouterOutput } from '../agents/intent.agent';
import { MemoryStateType, TaskOutput } from './types';

export const intentTask = task("intentRouter", async (
    params: { message: string },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    const response = await intentAgent({
        message: params.message,
        lastMessages: memory.lastMessages.map(msg => msg.user_message) || [],
    });

    return {
        response: {
            intent: response.intent,
            suggestedOptions: response.suggestedOptions || undefined,
            clarifyingQuestion: response.clarifyingQuestion || undefined,
        },
    }
});