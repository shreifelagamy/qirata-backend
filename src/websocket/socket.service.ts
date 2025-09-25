import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from '../types/socket.types';
import { logger } from '../utils/logger';
import { auth } from '../config/auth.config';
import { fromNodeHeaders } from 'better-auth/node';

class SocketService {
    private io!: Server<ClientToServerEvents, ServerToClientEvents>;
    private activeConnections: Map<string, AuthenticatedSocket>;

    constructor() {
        this.activeConnections = new Map();
    }

    public initializeSocket(server: HTTPServer): void {
        this.io = new Server(server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.setupMiddleware();
        this.setupEventHandlers();

        logger.info('WebSocket server initialized');
    }

    private setupMiddleware(): void {
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                const sessionId = socket.handshake.auth.sessionId;

                // First try to get session from cookies in headers
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(socket.handshake.headers)
                });

                if (session?.user) {
                    // Setup socket data from session
                    socket.data = {
                        userId: session.user.id,
                        isAuthenticated: true,
                        lastActivity: new Date(),
                        connectionTime: new Date(),
                        activeStreams: new Map(),
                        email: session.user.email,
                        name: session.user.name,
                        sessionId: sessionId || session.session.id
                    };

                    // Set userId on socket for convenience
                    socket.userId = session.user.id;

                    logger.info(`Socket authenticated via session for user: ${session.user.id} (${session.user.email})`);
                    return next();
                }

                // Fallback: Check for session token in handshake auth (for cases where cookies aren't available)
                const sessionToken = socket.handshake.auth.sessionToken;
                if (sessionToken) {
                    try {
                        // Create temporary headers with session token as cookie
                        const tempHeaders = {
                            cookie: `better-auth.session_token=${sessionToken}`
                        };

                        const tokenSession = await auth.api.getSession({
                            headers: fromNodeHeaders(tempHeaders)
                        });

                        if (tokenSession?.user) {
                            socket.data = {
                                userId: tokenSession.user.id,
                                isAuthenticated: true,
                                lastActivity: new Date(),
                                connectionTime: new Date(),
                                activeStreams: new Map(),
                                email: tokenSession.user.email,
                                name: tokenSession.user.name,
                                sessionId: sessionId || tokenSession.session.id
                            };

                            socket.userId = tokenSession.user.id;

                            logger.info(`Socket authenticated via session token for user: ${tokenSession.user.id} (${tokenSession.user.email})`);
                            return next();
                        }
                    } catch (tokenError) {
                        logger.warn('Session token validation failed:', tokenError);
                    }
                }

                throw new Error('No valid session found');

            } catch (error) {
                logger.error('Socket authentication failed:', error);
                next(new Error('Authentication failed'));
            }
        });
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            this.handleConnection(socket);

            // Import WebSocket Router and routes
            const { WebSocketRouter } = require('./websocket.router');
            const { socketRoutes } = require('../routes/websocket.routes');

            // Auto-register all events from routes
            Object.keys(socketRoutes).forEach(eventName => {
                socket.on(eventName, async (data) => {
                    await WebSocketRouter.handleEvent(eventName, socket, data);
                });
            });

            // Standard connection events
            socket.on('disconnect', () => {
                // Use router to handle disconnect via chat:disconnect event
                WebSocketRouter.handleEvent('chat:disconnect', socket, {});
                this.handleDisconnection(socket);
            });

            socket.on('ping', () => {
                socket.emit('pong');
            });

            // Error handling
            socket.on('error', (error) => {
                logger.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }

    public handleConnection(socket: AuthenticatedSocket): void {
        this.activeConnections.set(socket.id, socket);
        socket.data.lastActivity = new Date();

        logger.info(`Client connected: ${socket.id}`);
    }

    public handleDisconnection(socket: AuthenticatedSocket): void {
        this.activeConnections.delete(socket.id);
        logger.info(`Client disconnected: ${socket.id}`);
    }

    public emitEvent(event: string, data: any, socketId?: string): void {
        if (socketId) {
            const socket = this.activeConnections.get(socketId);
            if (socket) {
                socket.emit(event as keyof ServerToClientEvents, data);
            }
        } else {
            this.io.emit(event as keyof ServerToClientEvents, data);
        }
    }

    public broadcastEvent(event: string, data: any, room?: string): void {
        this.io.emit(event as keyof ServerToClientEvents, data);
    }

    public getActiveConnections(): Map<string, AuthenticatedSocket> {
        return this.activeConnections;
    }

    public getIO(): Server<ClientToServerEvents, ServerToClientEvents> {
        return this.io;
    }
}

export const socketService = new SocketService();