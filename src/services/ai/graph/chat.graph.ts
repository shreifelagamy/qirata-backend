import { END, START, StateGraph } from '@langchain/langgraph';
import { detectIntentNode, postQANode, socialPlatformNode, socialPostCreateNode, socialPostEditNode, socialPostSelectorNode, supportNode } from './nodes';
import { socialIntentNode } from './nodes/social-intent.node';
import { intentRouter, socialIntentRouter, socialPlatformRouter, socialPostSelectorRouter } from './routers';
import { ChatGraphState } from './state';

// Define the graph workflow
const workflow = new StateGraph(ChatGraphState)
    // Add nodes
    .addNode('DetectIntent', detectIntentNode)
    .addNode('Support', supportNode)
    .addNode('PostQA', postQANode)
    .addNode('SocialIntent', socialIntentNode)

    // Social flow
    .addNode('SocialPlatformClarification', socialPlatformNode)
    .addNode('SocialPostCreate', socialPostCreateNode)
    .addNode('SocialPostSelector', socialPostSelectorNode)
    .addNode('SocialPostEdit', socialPostEditNode)

    // Define edges
    .addEdge(START, 'DetectIntent')

    // Conditional routing based on intent
    .addConditionalEdges(
        'DetectIntent',
        intentRouter,
        // Map of possible destinations
        ['Support', 'PostQA', 'SocialIntent', END]
    )

    // Conditional routing based on social intent
    .addConditionalEdges(
        'SocialIntent',
        socialIntentRouter,
        // Map of possible destinations
        ['SocialPostSelector', 'SocialPlatformClarification', END]
    )

    // Conditional routing based on social platform detection
    .addConditionalEdges(
        'SocialPlatformClarification',
        socialPlatformRouter,
        // Map of possible destinations
        ['SocialPostCreate', END]
    )

    // Conditional routing based on post selection
    .addConditionalEdges(
        'SocialPostSelector',
        socialPostSelectorRouter,
        // Map of possible destinations
        ['SocialPostEdit', END]
    )

    // Terminal nodes
    .addEdge('Support', END)
    .addEdge('PostQA', END)
    .addEdge('SocialPlatformClarification', END)
    .addEdge('SocialPostCreate', END)
    .addEdge('SocialPostEdit', END);

// Compile the graph
export const chatGraph = workflow.compile();
                        