import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatGraphState } from './state';
import { intentNode } from './nodes/intent.node';

// Define the graph workflow
const workflow = new StateGraph(ChatGraphState)
    // Add nodes
    .addNode('intent', intentNode)
    
    // Define edges (Simple linear flow for now)
    .addEdge(START, 'intent')
    .addEdge('intent', END);

// Compile the graph
export const chatGraph = workflow.compile();
