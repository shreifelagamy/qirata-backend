import { Socket } from 'socket.io';
import { AICallbackData } from './ai.types';

export interface SocketEvent {
    name: string;
    data?: any;
}

// AI Streaming types
export interface ChatMessageData {
    sessionId: string;
    content: string;
}

export interface UserPreferences {
    voice?: 'professional' | 'friendly' | 'direct' | 'storyteller';
    contentStyle?: 'data-driven' | 'practical' | 'thought-provoking';
    hookPreference?: 'questions' | 'observations' | 'bold-claims';
    platform?: 'twitter' | 'linkedin' | 'general';
    length?: 'short' | 'medium' | 'long';
}

export interface AIStreamData extends AICallbackData {
    sessionId: string;
    intentType?: 'question' | 'social';
}

export interface StreamInterruptData {
    sessionId: string;
    reason?: string;
}

export interface PatternData {
    userId: string;
    pattern: string;
    frequency: number;
    lastSeen: Date;
}

export interface ClientToServerEvents {
    // Post events
    postCreated: (postId: string) => void;
    postUpdated: (postId: string) => void;
    postDeleted: (postId: string) => void;
    postRead: (postId: string) => void;

    // Chat events - Legacy
    messageReceived: (message: { roomId: string; content: string; userId: string }) => void;
    typingStatus: (data: { roomId: string; userId: string; isTyping: boolean }) => void;
    streamResponse: (data: { roomId: string; chunk: string }) => void;

    // AI Chat events - New
    'chat:message': (data: ChatMessageData) => void;
    'chat:interrupt': (data: StreamInterruptData) => void;
    'chat:join': (sessionId: string) => void;
    'chat:leave': (sessionId: string) => void;

    // Connection events
    disconnect: () => void;
    ping: () => void;
}

export interface ServerToClientEvents {
    // Post events
    onPostCreated: (postId: string) => void;
    onPostUpdated: (postId: string) => void;
    onPostDeleted: (postId: string) => void;
    onPostRead: (postId: string) => void;

    // Chat events - Legacy
    onMessageReceived: (message: { roomId: string; content: string; userId: string }) => void;
    onTypingStatus: (data: { roomId: string; userId: string; isTyping: boolean }) => void;
    onStreamResponse: (data: { roomId: string; chunk: string }) => void;

    // AI Chat events - New
    'chat:stream:start': (data: { sessionId: string; intentType?: string }) => void;
    'chat:stream:token': (data: { sessionId: string; token: string }) => void;
    'chat:stream:end': (data: { sessionId: string; fullContent: string }) => void;
    'chat:stream:error': (data: { sessionId: string; error: string }) => void;
    'chat:stream:interrupted': (data: { sessionId: string; message?: string; reason?: string }) => void;
    'chat:intent:detected': (data: { sessionId: string; intent: string; confidence: number }) => void;
    'chat:social:response': (data: { sessionId: string; socialContent: string; platform?: string; userMessage: string }) => void;

    // System events
    error: (error: { message: string; code: string }) => void;
    reconnect: () => void;
    pong: () => void;
}

export interface SocketData {
    userId: string;
    isAuthenticated: boolean;
    lastActivity: Date;
    connectionTime: Date;
    activeStreams?: Set<string>; // Track active streaming sessions
}

export interface AuthenticatedSocket extends Socket {
    id: string;
    userId?: string;
    rooms: Set<string>;
    data: SocketData;
}