import { task } from '@langchain/langgraph';
import { z } from 'zod';
import { PostsService } from '../../posts.service';
import { postQAAgent } from '../agents/post-qa.agent';
import { MemoryStateType, TaskOutput } from './types';

export const postQATask = task('postQA', async (
    params: { message: string; },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    const postService = new PostsService();

    // Get full conversation history (both user and AI messages)
    const lastMessages = memory.lastMessages || []

    // First try with summary only
    let qaResult = await postQAAgent({
        message: params.message,
        lastMessages,
        postSummary: memory.postSummary!,
        conversationSummary: memory.conversationSummary,
        postContent: 'undefined'
    });

    // If agent needs full content, fetch it and try again
    let fullContent = undefined;
    console.log("Needs Clarification : " + qaResult.needsFullContent)
    if (qaResult.needsFullContent) {
        console.log("should load from memory : " + memory.postContent)
        if (memory.postContent) {
            fullContent = memory.postContent;
        } else {
            console.log("Load from DB")
            const expandedPost = await postService.getExpanded(memory.currentPostId!, memory.userId);
            fullContent = expandedPost.content || '';
        }

        qaResult = await postQAAgent({
            message: params.message,
            lastMessages,
            postSummary: memory.postSummary!,
            conversationSummary: memory.conversationSummary,
            postContent: fullContent
        });
    }

    return {
        response: {
            message: qaResult.response,
            suggestedOptions: qaResult.suggestedOptions
        },
        contextUpdates: fullContent ? {
            postContent: fullContent
        } : undefined
    };
});