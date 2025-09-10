import { task } from '@langchain/langgraph';
import { z } from 'zod';
import { socialPostAgent } from '../agents/social-post.agent';
import { MemoryStateType, TaskOutput } from './types';

// Define the social post type for consistency
const SocialPostType = z.object({
    platform: z.string(),
    content: z.string(),
    id: z.string(),
    createdAt: z.date(),
    publishedAt: z.date().nullable()
});

export const socialPostEditTask = task('socialPostEdit', async (
    params: { message: string; socialPosts: z.infer<typeof SocialPostType>[] },
    memory: MemoryStateType
): Promise<z.infer<typeof TaskOutput>> => {
    // Ensure we have existing posts to edit
    if (!params.socialPosts || params.socialPosts.length === 0) {
        return {
            response: {
                message: "I couldn't find any social posts to edit in this session. Would you like to create a new social media post instead?",
                suggestedOptions: ["Create a new social media post", "Ask about content"]
            }
        };
    }

    try {
        // Edit the social post using the enhanced agent (no platform required - inferred from existing posts)
        const result = await socialPostAgent({
            message: params.message,
            lastMessages: memory.lastMessages || [],
            postSummary: memory.postSummary || null,
            platform: null, // No platform specified - agent will infer from existing posts
            socialMediaContentPreferences: memory.socialMediaContentPreferences || null,
            socialPosts: params.socialPosts.map(post => ({
                ...post,
                publishedAt: post.publishedAt || null // Convert undefined to null
            }))
        });

        // Validate that we got a socialPostId for edit requests
        let socialPostId = result.socialPostId || undefined;
        if (!result.socialPostId && params.socialPosts.length > 0) {
            console.warn('Agent did not return socialPostId for edit request, using most recent post as fallback');
            socialPostId = params.socialPosts[0].id; // Use most recent post as fallback
        }

        return {
            response: {
                message: `${result.message}\n\n**Updated Post:**\n${result.structuredPost.postContent}`,
                suggestedOptions: result.suggestedOptions,
                structuredPost: result.structuredPost,
                socialPostId
            },
            contextUpdates: {
                // Remove deprecated fields since we're using cache now
            }
        };

    } catch (error) {
        console.error('Error editing social post:', error);
        return {
            response: {
                message: "I encountered an error while editing your social post. Please try again.",
                suggestedOptions: ["Try again", "Create a new post instead"]
            }
        };
    }
});