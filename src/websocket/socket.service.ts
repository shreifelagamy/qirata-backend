import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents } from '../types/socket.types';
import { logger } from '../utils/logger';

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
                const token = socket.handshake.auth.token;
                if (!token) {
                    throw new Error('Authentication token missing');
                }

                // For now, extract userId from token (in production, use JWT validation)
                // This is a placeholder - implement proper JWT validation here
                const userId = 'anonymous';

                // Setup socket data
                socket.data = {
                    userId,
                    isAuthenticated: !!userId && userId !== 'anonymous',
                    lastActivity: new Date(),
                    connectionTime: new Date(),
                    activeStreams: new Set()
                };

                // Set userId on socket for convenience
                socket.userId = userId;

                logger.debug(`Socket authenticated for user: ${userId}`);
                next();
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