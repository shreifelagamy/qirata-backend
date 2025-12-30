import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Qirata API',
            version: '1.0.0',
            description: `
RESTful API for the Qirata platform providing content management,
real-time communication, and social media integration capabilities.

## Features
- Content management (links, posts)
- Real-time chat functionality
- Social media post management
- User authentication and authorization

## Authentication
API uses secure HTTP-only cookies for authentication. Authentication is handled
automatically through Better Auth's cookie-based session management.
Authentication endpoints are available at \`/api/auth/*\`.
      `,
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Development server',
            },
            {
                url: 'https://api.qirata.com/v1',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'better-auth.session_token',
                    description: 'Session cookie for authentication. Automatically managed by Better Auth.',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    required: ['message', 'status'],
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Human-readable error message',
                            example: 'Error occurred while processing request'
                        },
                        status: {
                            type: 'integer',
                            description: 'HTTP status code',
                            example: 400
                        },
                        errors: {
                            type: 'object',
                            description: 'Validation errors (optional)',
                            additionalProperties: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
                            },
                            example: {
                                'url': ['Must be a valid URL'],
                                'name': ['Name is required']
                            }
                        },
                        data: {
                            type: 'object',
                            description: 'Additional error context (development mode only)',
                            properties: {
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'Error timestamp'
                                },
                                path: {
                                    type: 'string',
                                    description: 'Request path'
                                },
                                method: {
                                    type: 'string',
                                    description: 'HTTP method'
                                },
                                stack: {
                                    type: 'string',
                                    description: 'Error stack trace (development only)'
                                }
                            }
                        }
                    },
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'object',
                            properties: {
                                items: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                    },
                                },
                                total: {
                                    type: 'integer',
                                    description: 'Total number of items',
                                },
                                page: {
                                    type: 'integer',
                                    description: 'Current page number (1-based)',
                                },
                                pageSize: {
                                    type: 'integer',
                                    description: 'Number of items per page',
                                },
                                totalPages: {
                                    type: 'integer',
                                    description: 'Total number of pages',
                                },
                            },
                        },
                        status: {
                            type: 'integer',
                            example: 200,
                            description: 'HTTP status code',
                        },
                    },
                },
                Link: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier',
                        },
                        url: {
                            type: 'string',
                            description: 'URL of the link',
                        },
                        name: {
                            type: 'string',
                            description: 'Name of the link',
                        },
                        rss_url: {
                            type: 'string',
                            description: 'RSS feed URL',
                        },
                        is_rss: {
                            type: 'boolean',
                            description: 'Whether this link is an RSS feed',
                        },
                        favicon_url: {
                            type: 'string',
                            nullable: true,
                            description: 'URL of the site favicon',
                        },
                        last_fetch_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Timestamp of the last successful post fetch',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                CreateLinkDto: {
                    type: 'object',
                    required: ['url', 'rss_url'],
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL of the link to add',
                        },
                        rss_url: {
                            type: 'string',
                            description: 'RSS feed URL',
                        },
                        name: {
                            type: 'string',
                            description: 'Optional name for the link',
                        },
                        is_rss: {
                            type: 'boolean',
                            description: 'Whether this link is an RSS feed',
                        },
                        favicon_url: {
                            type: 'string',
                            description: 'Optional favicon URL (auto-detected if not provided)',
                        },
                    },
                },
                PostSummary: {
                    type: 'object',
                    description: 'Post summary for list views (excludes content)',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        sequence_id: {
                            type: 'integer',
                            description: 'Auto-incrementing sequence ID for ordering',
                        },
                        feed_id: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'Associated feed ID',
                        },
                        feed: {
                            $ref: '#/components/schemas/Feed',
                            description: 'Associated feed details',
                        },
                        title: {
                            type: 'string',
                            description: 'Post title',
                        },
                        image_url: {
                            type: 'string',
                            nullable: true,
                            description: 'URL of the post image',
                        },
                        external_link: {
                            type: 'string',
                            description: 'Original link URL',
                        },
                        source: {
                            type: 'string',
                            description: 'Source name/RSS feed name (deprecated - use feed.name)',
                        },
                        user_read_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'When the user marked this post as read (from user_posts)',
                        },
                        user_bookmarked: {
                            type: 'boolean',
                            nullable: true,
                            description: 'Whether the user bookmarked this post (from user_posts)',
                        },
                        published_date: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'When the post was originally published',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Post: {
                    type: 'object',
                    allOf: [
                        { $ref: '#/components/schemas/PostSummary' },
                        {
                            type: 'object',
                            properties: {
                                content: {
                                    type: 'string',
                                    description: 'Full post content',
                                },
                            },
                        },
                    ],
                },
                PostExpanded: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        postId: {
                            type: 'string',
                            format: 'uuid',
                        },
                        expandedContent: {
                            type: 'string',
                            description: 'AI-expanded content',
                        },
                        chatSessionId: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Associated chat session ID',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                ChatSession: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier for the chat session',
                        },
                        title: {
                            type: 'string',
                            description: 'Chat session title',
                        },
                        post_id: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'Associated post ID',
                        },
                        summary: {
                            type: 'string',
                            nullable: true,
                            description: 'AI-generated summary of the chat session',
                        },
                        last_summary_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Timestamp when the summary was last updated',
                        },
                        is_favorite: {
                            type: 'boolean',
                            description: 'Whether the chat session is marked as favorite',
                            default: false,
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the chat session was created',
                        },
                        post: {
                            type: 'object',
                            nullable: true,
                            description: 'Associated post with expanded content',
                            properties: {
                                id: {
                                    type: 'string',
                                    format: 'uuid',
                                    description: 'Post ID',
                                },
                                title: {
                                    type: 'string',
                                    description: 'Post title',
                                },
                                external_link: {
                                    type: 'string',
                                    nullable: true,
                                    description: 'External URL of the post',
                                },
                                source: {
                                    type: 'string',
                                    nullable: true,
                                    description: 'Source of the post content',
                                },
                                content: {
                                    type: 'string',
                                    description: 'Post content',
                                },
                                image_url: {
                                    type: 'string',
                                    nullable: true,
                                    description: 'URL of the post image',
                                },
                                read_at: {
                                    type: 'string',
                                    format: 'date-time',
                                    nullable: true,
                                    description: 'Timestamp when the post was marked as read',
                                },
                                created_at: {
                                    type: 'string',
                                    format: 'date-time',
                                    description: 'When the post was created',
                                },
                                expanded: {
                                    type: 'object',
                                    nullable: true,
                                    description: 'AI-expanded content of the post',
                                    properties: {
                                        id: {
                                            type: 'string',
                                            format: 'uuid',
                                            description: 'Expanded content ID',
                                        },
                                        post_id: {
                                            type: 'string',
                                            format: 'uuid',
                                            description: 'Associated post ID',
                                        },
                                        content: {
                                            type: 'string',
                                            description: 'Expanded content text',
                                        },
                                        created_at: {
                                            type: 'string',
                                            format: 'date-time',
                                            description: 'When the expanded content was created',
                                        },
                                        updated_at: {
                                            type: 'string',
                                            format: 'date-time',
                                            description: 'When the expanded content was last updated',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                CreateChatSessionDto: {
                    type: 'object',
                    required: ['title'],
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Chat session title',
                        },
                        postId: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Optional post ID to associate',
                        },
                    },
                },
                Settings: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        key: {
                            type: 'string',
                            description: 'Setting key',
                        },
                        value: {
                            type: 'string',
                            description: 'Setting value',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                CreateSettingsDto: {
                    type: 'object',
                    required: ['key', 'value'],
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Setting key',
                        },
                        value: {
                            type: 'string',
                            description: 'Setting value',
                        },
                    },
                },
                UpdateSettingsDto: {
                    type: 'object',
                    properties: {
                        value: {
                            type: 'string',
                            description: 'New setting value',
                        },
                    },
                },
                Message: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier for the message',
                        },
                        chat_session_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Associated chat session ID',
                        },
                        user_message: {
                            type: 'string',
                            description: 'User message content',
                        },
                        ai_response: {
                            type: 'string',
                            description: 'AI response content - for social posts, this contains JSON structured data',
                        },
                        type: {
                            type: 'string',
                            enum: ['message', 'social_post'],
                            description: 'Type of message - determines how the ai_response should be interpreted',
                            default: 'message'
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the message was created',
                        },
                    },
                },
                UserPreferencesDto: {
                    type: 'object',
                    properties: {
                        tone: {
                            type: 'string',
                            description: 'Preferred tone for AI responses',
                            example: 'professional',
                        },
                        platform: {
                            type: 'string',
                            enum: ['twitter', 'linkedin', 'general'],
                            description: 'Target social media platform',
                            example: 'linkedin',
                        },
                        length: {
                            type: 'string',
                            enum: ['short', 'medium', 'long'],
                            description: 'Preferred response length',
                            example: 'medium',
                        },
                    },
                },
                SendMessageDto: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: {
                            type: 'string',
                            description: 'User message to send to AI',
                            example: 'What are the main points in this article?',
                        },
                        postContent: {
                            type: 'string',
                            description: 'Optional post content for context',
                        },
                        userPreferences: {
                            $ref: '#/components/schemas/UserPreferencesDto',
                        },
                    },
                },
                StreamMessageDto: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: {
                            type: 'string',
                            description: 'User message to send to AI for streaming',
                            example: 'Create a LinkedIn post about AI trends',
                        },
                        postContent: {
                            type: 'string',
                            description: 'Optional post content for context',
                        },
                        userPreferences: {
                            $ref: '#/components/schemas/UserPreferencesDto',
                        },
                    },
                },
                AIIntent: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['question', 'social_post'],
                            description: 'Detected intent type',
                        },
                        confidence: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                            description: 'Confidence score for intent detection',
                        },
                        keywords: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                            description: 'Keywords that triggered the intent detection',
                        },
                    },
                },
                AIResponse: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'AI-generated response content',
                        },
                        intent: {
                            $ref: '#/components/schemas/AIIntent',
                        },
                        sessionId: {
                            type: 'string',
                            description: 'Chat session ID',
                        },
                        tokenCount: {
                            type: 'integer',
                            description: 'Estimated token count for the response',
                        },
                        processingTime: {
                            type: 'integer',
                            description: 'Processing time in milliseconds',
                        },
                    },
                },
                SendMessageResponse: {
                    type: 'object',
                    properties: {
                        message: {
                            $ref: '#/components/schemas/Message',
                        },
                        aiResponse: {
                            $ref: '#/components/schemas/AIResponse',
                        },
                        session: {
                            $ref: '#/components/schemas/ChatSession',
                        },
                    },
                },
                StreamingResponse: {
                    type: 'object',
                    properties: {
                        sessionId: {
                            type: 'string',
                            description: 'Chat session ID',
                        },
                        isComplete: {
                            type: 'boolean',
                            description: 'Whether the streaming is complete',
                        },
                        content: {
                            type: 'string',
                            description: 'Complete response content (for completed streams)',
                        },
                        error: {
                            type: 'string',
                            description: 'Error message if streaming failed',
                        },
                    },
                },
                AIStats: {
                    type: 'object',
                    properties: {
                        totalSessions: {
                            type: 'integer',
                            description: 'Number of active AI sessions',
                        },
                        totalTokens: {
                            type: 'integer',
                            description: 'Total tokens used across all sessions',
                        },
                    },
                },
                ConnectionTestResponse: {
                    type: 'object',
                    properties: {
                        connected: {
                            type: 'boolean',
                            description: 'Whether the AI service is connected',
                        },
                        message: {
                            type: 'string',
                            description: 'Connection status message',
                        },
                    },
                },
                ClearMemoryResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Whether the memory was cleared successfully',
                        },
                        message: {
                            type: 'string',
                            description: 'Status message',
                        },
                    },
                },
                SocialPost: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier for the social post',
                        },
                        platform: {
                            type: 'string',
                            enum: ['twitter', 'linkedin', 'facebook', 'instagram'],
                            description: 'Social media platform',
                            example: 'linkedin',
                        },
                        content: {
                            type: 'string',
                            description: 'Social post content text',
                        },
                        image_urls: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'uri',
                            },
                            nullable: true,
                            description: 'URLs of images attached to the post',
                        },
                        code_examples: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    language: {
                                        type: 'string',
                                        description: 'Programming language',
                                        example: 'javascript',
                                    },
                                    code: {
                                        type: 'string',
                                        description: 'Code snippet',
                                        example: 'console.log("Hello World");',
                                    },
                                    description: {
                                        type: 'string',
                                        description: 'Optional description of the code',
                                        example: 'Simple greeting function',
                                    },
                                },
                                required: ['language', 'code'],
                            },
                            nullable: true,
                            description: 'Array of code examples included in the post',
                        },
                        visual_elements: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: {
                                        type: 'string',
                                        description: 'Type of visual element',
                                        example: 'diagram',
                                    },
                                    description: {
                                        type: 'string',
                                        description: 'Description of the visual element',
                                        example: 'Flow chart showing the process',
                                    },
                                    suggestion: {
                                        type: 'string',
                                        description: 'Optional suggestion for the visual element',
                                        example: 'Use a simple flowchart with clear arrows',
                                    },
                                },
                                required: ['type', 'description'],
                            },
                            nullable: true,
                            description: 'Array of visual elements suggestions for the post',
                        },
                        chat_session_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Associated chat session ID',
                        },
                        post_id: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'Associated post ID',
                        },
                        published_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'When the post was published',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the social post was created',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the social post was last updated',
                        },
                    },
                },

                // WebSocket Event Schemas
                WebSocketClientEvents: {
                    type: 'object',
                    title: 'WebSocket Client Events',
                    description: 'Events sent from client to server for real-time chat functionality',
                    properties: {
                        'chat:message': {
                            type: 'object',
                            description: 'Send a message to start AI chat interaction (supports both Q&A and social post generation)',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    pattern: '^[a-zA-Z0-9\\-_]+$',
                                    description: 'Unique chat session identifier',
                                    example: 'session_12345'
                                },
                                content: {
                                    type: 'string',
                                    minLength: 1,
                                    maxLength: 10000,
                                    description: 'Message content from user',
                                    example: 'Create a LinkedIn post about TypeScript best practices'
                                }
                            },
                            required: ['sessionId', 'content']
                        },
                        'chat:interrupt': {
                            type: 'object',
                            description: 'Interrupt ongoing AI chat operation',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    description: 'Session ID to interrupt',
                                    example: 'session_12345'
                                },
                                reason: {
                                    type: 'string',
                                    maxLength: 500,
                                    description: 'Optional reason for interruption',
                                    example: 'User cancelled request'
                                }
                            },
                            required: ['sessionId']
                        },
                        'chat:join': {
                            type: 'string',
                            pattern: '^[a-zA-Z0-9\\-_]+$',
                            description: 'Join a chat session (sessionId as string)',
                            example: 'session_12345'
                        },
                        'chat:leave': {
                            type: 'string',
                            pattern: '^[a-zA-Z0-9\\-_]+$',
                            description: 'Leave a chat session (sessionId as string)',
                            example: 'session_12345'
                        },
                        'chat:disconnect': {
                            type: 'null',
                            description: 'Socket disconnect event (automatically handled)'
                        }
                    }
                },

                WebSocketServerEvents: {
                    type: 'object',
                    title: 'WebSocket Server Events',
                    description: 'Events sent from server to clients during AI chat interactions',
                    properties: {
                        'chat:stream:start': {
                            type: 'object',
                            description: 'AI processing started',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    example: 'session_12345'
                                },
                                intentType: {
                                    type: 'string',
                                    example: 'Processing...'
                                }
                            }
                        },
                        'chat:stream:token': {
                            type: 'object',
                            description: 'Real-time token streaming from AI',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    example: 'session_12345'
                                },
                                token: {
                                    type: 'string',
                                    description: 'Individual token from AI response',
                                    example: 'Hello'
                                }
                            }
                        },
                        'chat:stream:end': {
                            type: 'object',
                            description: 'AI response completed',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    description: 'Chat session identifier',
                                    example: 'session_12345'
                                },
                                message: {
                                    type: 'string',
                                    description: 'Status message',
                                    example: 'Process completed'
                                },
                                response: {
                                    type: 'string',
                                    description: 'Complete AI response text',
                                    example: 'Here is your LinkedIn post about TypeScript best practices...'
                                },
                                suggestedOptions: {
                                    type: 'array',
                                    items: {
                                        type: 'string'
                                    },
                                    description: 'Array of suggested follow-up options',
                                    example: ['Edit this post', 'Create another post', 'Ask a question']
                                },
                                messageType: {
                                    type: 'string',
                                    enum: ['message', 'social_post'],
                                    description: 'Type of message - determines how frontend should handle the response',
                                    example: 'social_post'
                                },
                                structuredPost: {
                                    type: 'object',
                                    nullable: true,
                                    description: 'Structured social post data (only present when messageType is social_post)',
                                    properties: {
                                        postContent: {
                                            type: 'string',
                                            description: 'Main social media post content',
                                            example: '🚀 TypeScript Best Practices for 2024\n\nKey takeaways:\n• Use strict type checking\n• Leverage utility types\n• Implement proper error handling\n\n#TypeScript #WebDev'
                                        },
                                        codeExamples: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    language: {
                                                        type: 'string',
                                                        description: 'Programming language',
                                                        example: 'typescript'
                                                    },
                                                    code: {
                                                        type: 'string',
                                                        description: 'Code snippet',
                                                        example: 'interface User {\n  id: string;\n  name: string;\n  email?: string;\n}'
                                                    },
                                                    description: {
                                                        type: 'string',
                                                        description: 'Optional description of the code',
                                                        example: 'Basic user interface with optional email'
                                                    }
                                                },
                                                required: ['language', 'code']
                                            },
                                            description: 'Array of code examples to display with the post'
                                        },
                                        visualElements: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    type: {
                                                        type: 'string',
                                                        description: 'Type of visual element',
                                                        example: 'diagram'
                                                    },
                                                    description: {
                                                        type: 'string',
                                                        description: 'Description of what the visual should show',
                                                        example: 'Flow chart showing TypeScript compilation process'
                                                    },
                                                    content: {
                                                        type: 'string',
                                                        description: 'Content or data for the visual',
                                                        example: 'TS Files → Type Checking → JS Output'
                                                    },
                                                    style: {
                                                        type: 'string',
                                                        description: 'Styling suggestions for the visual',
                                                        example: 'Clean, modern flow chart with blue accents'
                                                    }
                                                },
                                                required: ['type', 'description', 'content', 'style']
                                            },
                                            description: 'Array of visual elements to create for the post'
                                        }
                                    },
                                    example: {
                                        postContent: '🚀 TypeScript Best Practices for 2024...',
                                        codeExamples: [
                                            {
                                                language: 'typescript',
                                                code: 'interface User { id: string; name: string; }',
                                                description: 'Basic user interface'
                                            }
                                        ],
                                        visualElements: [
                                            {
                                                type: 'infographic',
                                                description: 'TypeScript benefits overview',
                                                content: 'Type Safety, Better IDE Support, Early Error Detection',
                                                style: 'Modern, clean design with icons'
                                            }
                                        ]
                                    }
                                }
                            },
                            required: ['sessionId', 'message', 'response', 'suggestedOptions', 'messageType']
                        },
                        'chat:stream:interrupted': {
                            type: 'object',
                            description: 'Chat operation was interrupted',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    example: 'session_12345'
                                },
                                message: {
                                    type: 'string',
                                    description: 'Interruption status message',
                                    example: 'Stream interrupted successfully'
                                },
                                reason: {
                                    type: 'string',
                                    description: 'Reason for interruption',
                                    example: 'user request'
                                }
                            }
                        },
                        'chat:stream:error': {
                            type: 'object',
                            description: 'Error occurred during chat operation',
                            properties: {
                                sessionId: {
                                    type: 'string',
                                    example: 'session_12345'
                                },
                                error: {
                                    type: 'string',
                                    description: 'Error message',
                                    example: 'AI service unavailable'
                                },
                                details: {
                                    type: 'string',
                                    description: 'Additional error details',
                                    example: 'Connection timeout'
                                }
                            }
                        }
                    }
                },
                // Authentication schemas
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique user identifier'
                        },
                        name: {
                            type: 'string',
                            description: 'User full name'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address'
                        },
                        emailVerified: {
                            type: 'boolean',
                            description: 'Whether the user email is verified'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the user account was created'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the user account was last updated'
                        }
                    }
                },
                RegisterRequest: {
                    type: 'object',
                    required: ['name', 'email', 'password'],
                    properties: {
                        name: {
                            type: 'string',
                            minLength: 2,
                            maxLength: 100,
                            description: 'User full name',
                            example: 'John Doe'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'john.doe@example.com'
                        },
                        password: {
                            type: 'string',
                            minLength: 8,
                            maxLength: 128,
                            description: 'User password (minimum 8 characters)',
                            example: 'securePassword123'
                        }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'john.doe@example.com'
                        },
                        password: {
                            type: 'string',
                            description: 'User password',
                            example: 'securePassword123'
                        }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        user: {
                            $ref: '#/components/schemas/User',
                            description: 'Authenticated user information'
                        },
                        message: {
                            type: 'string',
                            description: 'Success message',
                            example: 'Login successful'
                        }
                    },
                    description: 'Authentication response. Session is managed via secure HTTP-only cookies.'
                },
                ForgotPasswordRequest: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address to send password reset link',
                            example: 'john.doe@example.com'
                        }
                    }
                },
                ResetPasswordRequest: {
                    type: 'object',
                    required: ['token', 'password'],
                    properties: {
                        token: {
                            type: 'string',
                            description: 'Password reset token from email',
                            example: 'abc123def456...'
                        },
                        password: {
                            type: 'string',
                            minLength: 8,
                            maxLength: 128,
                            description: 'New password (minimum 8 characters)',
                            example: 'newSecurePassword123'
                        }
                    }
                },
                Category: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier',
                        },
                        user_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'User who owns this category',
                        },
                        name: {
                            type: 'string',
                            maxLength: 100,
                            description: 'Category name',
                            example: 'Tech Blogs',
                        },
                        parent_id: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'Parent category ID for nested folders',
                        },
                        children: {
                            type: 'array',
                            description: 'Child categories (subcategories)',
                            items: {
                                $ref: '#/components/schemas/Category',
                            },
                        },
                        user_feeds: {
                            type: 'array',
                            description: 'Feeds in this category',
                            items: {
                                $ref: '#/components/schemas/UserFeed',
                            },
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Feed: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier',
                        },
                        url: {
                            type: 'string',
                            maxLength: 2000,
                            description: 'RSS feed URL',
                        },
                        name: {
                            type: 'string',
                            maxLength: 255,
                            description: 'Feed name',
                        },
                        favicon_url: {
                            type: 'string',
                            maxLength: 2000,
                            nullable: true,
                            description: 'Feed favicon URL',
                        },
                        last_fetch_at: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Last time feed was fetched',
                        },
                        last_modified: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Last-Modified header from feed',
                        },
                        etag: {
                            type: 'string',
                            maxLength: 255,
                            nullable: true,
                            description: 'ETag header from feed',
                        },
                        fetch_error_count: {
                            type: 'integer',
                            default: 0,
                            description: 'Consecutive fetch error count',
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'inactive', 'error'],
                            default: 'active',
                            description: 'Feed health status',
                        },
                        subscriber_count: {
                            type: 'integer',
                            default: 0,
                            description: 'Number of users subscribed to this feed',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                UserFeed: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Unique identifier',
                        },
                        user_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'User ID',
                        },
                        feed_id: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Feed ID',
                        },
                        feed: {
                            $ref: '#/components/schemas/Feed',
                            description: 'Associated feed details',
                        },
                        category_id: {
                            type: 'string',
                            format: 'uuid',
                            nullable: true,
                            description: 'Category/folder ID',
                        },
                        custom_name: {
                            type: 'string',
                            maxLength: 255,
                            nullable: true,
                            description: 'User\'s custom name for this feed',
                        },
                        subscribed_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When user subscribed to this feed',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
            },
        },
    },
    apis: [
        './src/controllers/*.ts',
        './src/routes/*.ts',
    ],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
    // Swagger UI setup
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Qirata API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
        },
    }));

    // Swagger JSON endpoint
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
    });

    console.log('📚 Swagger documentation available at /api-docs');
};

export { specs };
