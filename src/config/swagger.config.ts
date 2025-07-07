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
API uses JWT tokens for authentication. Include the token in the
Authorization header as \`Bearer <token>\`.
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
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from the authentication endpoint',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'object',
                            properties: {
                                code: {
                                    type: 'string',
                                    description: 'Error code identifier',
                                },
                                message: {
                                    type: 'string',
                                    description: 'Human-readable error message',
                                },
                            },
                        },
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
                        title: {
                            type: 'string',
                            description: 'Title of the linked content',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        lastFetchAt: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            description: 'Timestamp of the last successful post fetch',
                        },
                    },
                },
                CreateLinkDto: {
                    type: 'object',
                    required: ['url'],
                    properties: {
                        url: {
                            type: 'string',
                            description: 'URL of the link to add',
                        },
                        title: {
                            type: 'string',
                            description: 'Optional title for the link',
                        },
                    },
                },
                Post: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        title: {
                            type: 'string',
                            description: 'Post title',
                        },
                        content: {
                            type: 'string',
                            description: 'Post content',
                        },
                        expandedContent: {
                            type: 'string',
                            description: 'AI-expanded content of the post',
                            nullable: true,
                        },
                        read: {
                            type: 'boolean',
                            description: 'Whether the post has been read',
                        },
                        publishedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'When the post was published',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        link: {
                            $ref: '#/components/schemas/Link',
                            description: 'Associated link',
                        },
                    },
                },
                CreatePostDto: {
                    type: 'object',
                    required: ['title', 'content'],
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Post title',
                        },
                        content: {
                            type: 'string',
                            description: 'Post content',
                        },
                        linkId: {
                            type: 'string',
                            format: 'uuid',
                            description: 'Associated link ID',
                        },
                        publishedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Publication date',
                        },
                    },
                },
                UpdatePostDto: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Post title',
                        },
                        content: {
                            type: 'string',
                            description: 'Post content',
                        },
                        read: {
                            type: 'boolean',
                            description: 'Mark as read/unread',
                        },
                    },
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
                            description: 'AI response content',
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
