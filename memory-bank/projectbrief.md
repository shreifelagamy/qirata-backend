# Project Brief - Qirata Express Backend

## Project Overview
Qirata Express Backend is a sophisticated TypeScript-based backend application designed to provide intelligent AI-powered chat services with real-time streaming capabilities and advanced content generation features.

## Core Purpose
The project serves as the backbone for an AI chat platform that combines traditional Q&A functionality with specialized social media content generation, providing users with personalized, context-aware responses through real-time WebSocket streaming.

## Key Value Propositions

### 1. Intelligent AI Orchestration
- **Dual-Service Architecture**: Primary LangGraph-based workflow orchestration with LangChain fallback
- **Intent-Driven Routing**: Automatic detection between question-answering and social content generation
- **Platform-Specific Generation**: Tailored content for Twitter, LinkedIn, Facebook, and Instagram
- **Multi-Modal AI Integration**: Seamless integration with Ollama for local AI model hosting

### 2. Real-Time Streaming Experience
- **WebSocket-Based Communication**: Real-time bidirectional communication using Socket.IO
- **Token-Level Streaming**: Live AI response streaming with token-by-token updates
- **Stream Management**: Advanced cancellation and interruption handling
- **Session-Based Processing**: Concurrent request management per user session

### 3. Personalized User Experience
- **Style Wizard System**: Pre-configured personality profiles (data_analyst, thought_leader, community_builder, storyteller)
- **Pattern Learning**: Intelligent extraction and application of user preferences from interactions
- **Context-Aware Responses**: Dynamic tone and format adjustment based on user history
- **Memory Management**: Conversation history tracking and context preservation

### 4. Scalable Architecture
- **Modular Design**: Separated concerns with dedicated nodes, routers, and builders
- **Database Integration**: PostgreSQL with TypeORM for robust data persistence
- **Token-Efficient Processing**: Optimized post summarization to reduce API token consumption
- **Production-Ready**: Comprehensive error handling, logging, and monitoring

## Target Use Cases

### Content Creation
- Generate platform-specific social media posts
- Create engaging content with appropriate tone and format
- Adapt content style based on user preferences and platform requirements

### Knowledge Management
- Provide contextual Q&A responses
- Maintain conversation history and context
- Extract and apply user interaction patterns

### Developer Experience
- Comprehensive API documentation with Swagger
- Real-time debugging and monitoring capabilities
- Flexible configuration system for different deployment environments

## Success Metrics
- **Response Quality**: Context-aware, personalized AI responses
- **User Engagement**: Seamless real-time streaming experience
- **Performance**: Efficient token usage and fast response times
- **Scalability**: Support for concurrent users and sessions
- **Reliability**: Robust error handling and graceful degradation

## Technical Foundation
- **Language**: TypeScript with strict type checking
- **Framework**: Express.js with comprehensive middleware stack
- **AI Integration**: LangChain, LangGraph, and Ollama
- **Database**: PostgreSQL with TypeORM
- **Real-Time**: Socket.IO for WebSocket communication
- **Validation**: Zod schemas for structured data validation

## Current Status
The project is actively developed with a working implementation featuring modular LangGraph architecture, real-time streaming capabilities, and comprehensive AI services. The system is production-ready with ongoing enhancements for token efficiency and user experience optimization.