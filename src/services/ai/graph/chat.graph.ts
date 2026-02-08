import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatGraphState } from './state';
import { intentNode, supportNode, postQANode, platformNode, platformClarificationNode, socialPostNode, socialPostEditNode } from './nodes';
import { intentRouter, platformRouter } from './routers';

// Define the graph workflow
const workflow = new StateGraph(ChatGraphState)
    // Add nodes
    .addNode('intent', intentNode)
    .addNode('support', supportNode)
    .addNode('postQA', postQANode)
    .addNode('platform', platformNode)
    .addNode('platformClarification', platformClarificationNode)
    .addNode('socialPost', socialPostNode)
    .addNode('socialPostEdit', socialPostEditNode)
    
    // Define edges
    .addEdge(START, 'intent')
    
    // Conditional routing based on intent
    .addConditionalEdges(
        'intent',
        intentRouter,
        // Map of possible destinations
        ['support', 'postQA', 'platform', 'socialPostEdit', END]
    )
    
    // Conditional routing based on platform detection
    .addConditionalEdges(
        'platform',
        platformRouter,
        // Map of possible destinations
        ['socialPost', 'platformClarification', END]
    )
    
    // Terminal nodes
    .addEdge('support', END)
    .addEdge('postQA', END)
    .addEdge('platformClarification', END)
    .addEdge('socialPost', END)
    .addEdge('socialPostEdit', END);

// Compile the graph
export const chatGraph = workflow.compile();
