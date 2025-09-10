import { task } from '@langchain/langgraph';
import { z } from 'zod';
import { socialPostAgent } from '../agents/social-post.agent';
import { MemoryStateType, TaskOutput } from './types';

export const socialPostTask = task('socialPost', async (
    params: { message: string },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    // Ensure we have a platform detected in memory
    if (!memory.detectedPlatform) {
        return {
            response: {
                message: "I need to know which platform you'd like to create content for. Please specify Twitter or LinkedIn.",
                suggestedOptions: ["Create Twitter post", "Create LinkedIn post"]
            }
        };
    }

    try {
        // Generate the social post using the new simplified agent
        const result = await socialPostAgent({
            message: params.message,
            lastMessages: memory.lastMessages || [],
            postSummary: memory.postSummary || null,
            platform: memory.detectedPlatform || null,
            socialMediaContentPreferences: memory.socialMediaContentPreferences || null,
            socialPosts: null
        });

        return {
            response: {
                message: `${result.message}\n\n**Generated ${memory.detectedPlatform} Post:**\n${result.socialPostContent}`,
                suggestedOptions: result.suggestedOptions,
                socialPostContent: result.socialPostContent,
                socialPostId: result.socialPostId || undefined
            },
            contextUpdates: {
                // Remove deprecated fields since we're using cache now
            }
        };

    } catch (error) {
        console.error('Error generating social post:', error);
        return {
            response: {
                message: "I encountered an error while creating your social post. Please try again.",
                suggestedOptions: ["Try again", "Ask a question instead"]
            }
        };
    }
});