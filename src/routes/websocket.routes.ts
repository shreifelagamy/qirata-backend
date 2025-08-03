import { ChatController } from '../controllers/websocket/chat.controller';
import { ValidationRule } from '../middleware/websocket.middleware';

/**
 * WebSocket Routes - Laravel Broadcasting Style
 * Maps WebSocket events to controller methods with middleware and validation
 */

interface SocketRoute {
    controller: any;
    method: string;
    middleware?: string[];
    validation?: ValidationRule[];
}

export const socketRoutes: Record<string, SocketRoute> = {
    // Main Chat Events (handles both Q&A and social generation)
    'chat:message': {
        controller: ChatController,
        method: 'handleMessage',
        middleware: ['auth', 'rateLimit', 'validation'],
        validation: [
            {
                field: 'sessionId',
                type: 'string',
                required: true,
                minLength: 1,
                pattern: /^[a-zA-Z0-9\-_]+$/
            },
            {
                field: 'content',
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 10000
            }
        ]
    },

    'chat:interrupt': {
        controller: ChatController,
        method: 'handleInterrupt',
        middleware: ['auth', 'validation'],
        validation: [
            {
                field: 'sessionId',
                type: 'string',
                required: true,
                minLength: 1
            },
            {
                field: 'reason',
                type: 'string',
                required: false,
                maxLength: 500
            }
        ]
    },

    'chat:join': {
        controller: ChatController,
        method: 'joinSession',
        middleware: ['auth', 'validation'],
        validation: [
            {
                field: '',
                type: 'string',
                required: true,
                minLength: 1,
                custom: (value) => {
                    if (typeof value !== 'string') return 'Session ID must be a string';
                    if (!/^[a-zA-Z0-9\-_]+$/.test(value)) return 'Session ID contains invalid characters';
                    return true;
                }
            }
        ]
    },

    'chat:leave': {
        controller: ChatController,
        method: 'leaveSession',
        middleware: ['auth', 'validation'],
        validation: [
            {
                field: '',
                type: 'string',
                required: true,
                minLength: 1,
                custom: (value) => {
                    if (typeof value !== 'string') return 'Session ID must be a string';
                    if (!/^[a-zA-Z0-9\-_]+$/.test(value)) return 'Session ID contains invalid characters';
                    return true;
                }
            }
        ]
    },

    // User Preferences (affects AI responses)
    'chat:preferences': {
        controller: ChatController,
        method: 'updatePreferences',
        middleware: ['auth', 'validation'],
        validation: [
            {
                field: 'preferences',
                type: 'object',
                required: true
            },
            {
                field: 'preferences.voice',
                type: 'string',
                required: false,
                custom: (value) => {
                    if (value && !['professional', 'friendly', 'direct', 'storyteller'].includes(value)) {
                        return 'Voice must be one of: professional, friendly, direct, storyteller';
                    }
                    return true;
                }
            },
            {
                field: 'preferences.platform',
                type: 'string',
                required: false,
                custom: (value) => {
                    if (value && !['twitter', 'linkedin', 'general'].includes(value)) {
                        return 'Platform must be one of: twitter, linkedin, general';
                    }
                    return true;
                }
            }
        ]
    },

    // Socket disconnect event
    'chat:disconnect': {
        controller: ChatController,
        method: 'handleDisconnect'
    },

    // Legacy Events (backward compatibility)
    'messageReceived': {
        controller: ChatController,
        method: 'handleLegacyMessage',
        validation: [
            {
                field: 'roomId',
                type: 'string',
                required: true,
                minLength: 1
            },
            {
                field: 'content',
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 10000
            },
            {
                field: 'userId',
                type: 'string',
                required: true,
                minLength: 1
            }
        ]
    },

    'typingStatus': {
        controller: ChatController,
        method: 'handleTypingStatus',
        validation: [
            {
                field: 'roomId',
                type: 'string',
                required: true,
                minLength: 1
            },
            {
                field: 'userId',
                type: 'string',
                required: true,
                minLength: 1
            },
            {
                field: 'isTyping',
                type: 'boolean',
                required: true
            }
        ]
    },

    'streamResponse': {
        controller: ChatController,
        method: 'handleStreamResponse',
        validation: [
            {
                field: 'roomId',
                type: 'string',
                required: true,
                minLength: 1
            },
            {
                field: 'chunk',
                type: 'string',
                required: true
            }
        ]
    }
};