import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatGraphState } from './state';
import { intentNode } from './nodes/intent.node';
import { supportNode } from './nodes/support.node';
import { postQANode } from './nodes/post-qa.node';
import { intentRouter } from './routers/intent.router';

// Define the graph workflow
const workflow = new StateGraph(ChatGraphState)
    // Add nodes
    .addNode('intent', intentNode)
    .addNode('support', supportNode)
    .addNode('postQA', postQANode)
    
    // Define edges
    .addEdge(START, 'intent')
    
    // Conditional routing based on intent
    .addConditionalEdges(
        'intent',
        intentRouter,
        // Map of possible destinations
        ['support', 'postQA', END]
    )
    
    // Support node goes to END
    .addEdge('support', END)
    // PostQA node goes to END
    .addEdge('postQA', END);

// Compile the graph
export const chatGraph = workflow.compile();
