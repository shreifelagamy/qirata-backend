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
            postSummary: memory.postSummary,
            platform: memory.detectedPlatform,
            socialMediaContentPreferences: undefined // TODO: Get from user settings
        });

        return {
            response: {
                message: `${result.message}\n\n**Generated ${memory.detectedPlatform} Post:**\n${result.socialPostContent}`,
                suggestedOptions: result.suggestedOptions
            },
            contextUpdates: {
                // Store the generated social post content for future reference
                lastGeneratedSocialPost: result.socialPostContent,
                lastGeneratedPlatform: memory.detectedPlatform
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