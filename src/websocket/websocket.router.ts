import { webSocketMiddleware } from '../middleware/websocket.middleware';
import { socketRoutes } from '../routes/websocket.routes';
import { AuthenticatedSocket } from '../types/socket.types';
import { logger } from '../utils/logger';

/**
 * WebSocket Router - Laravel Broadcasting Style
 * Handles event routing to controllers with middleware support
 */
export class WebSocketRouter {

    /**
     * Handle incoming WebSocket event
     * @param eventName - The WebSocket event name
     * @param socket - Authenticated socket connection
     * @param data - Event data from client
     */
    static async handleEvent(
        eventName: string,
        socket: AuthenticatedSocket,
        data: any
    ): Promise<void> {
        try {
            const route = socketRoutes[eventName];

            if (!route) {
                socket.emit('error', {
                    message: `Unknown event: ${eventName}`,
                    code: 'UNKNOWN_EVENT'
                });
                return;
            }

            // Apply middleware
            if (route.middleware) {
                const middlewareResult = await this.applyMiddleware(
                    route.middleware,
                    socket,
                    data,
                    eventName
                );
                if (!middlewareResult.success) {
                    socket.emit('error', middlewareResult.error);
                    return;
                }
            }

            // Create socket emitter function for controller
            const emit = (event: string, responseData: any) => {
                socket.emit(event, responseData);
            };

            // Get controller instance and call method
            const controllerInstance = new route.controller();
            const handler = controllerInstance[route.method];

            if (typeof handler === 'function') {
                await handler.call(
                    controllerInstance,
                    data,
                    socket,
                    emit
                );
            } else {
                throw new Error(`Method ${route.method} not found in controller`);
            }

        } catch (error) {
            logger.error(`Error handling WebSocket event ${eventName}:`, error);
            socket.emit('error', {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'HANDLER_ERROR'
            });
        }
    }

    /**
     * Apply middleware to WebSocket event
     * @param middleware - Array of middleware names
     * @param socket - Authenticated socket connection
     * @param data - Event data
     */
    private static async applyMiddleware(
        middleware: string[],
        socket: AuthenticatedSocket,
        data: any,
        eventName?: string
    ): Promise<{ success: boolean; error?: any }> {
        const route = eventName ? socketRoutes[eventName] : null;

        for (const middlewareName of middleware) {
            try {
                let middlewareResult;

                switch (middlewareName) {
                    case 'validation':
                        // Pass validation rules from route configuration
                        const validationRules = route?.validation;
                        middlewareResult = await webSocketMiddleware.getMiddleware('validation')(
                            socket,
                            data,
                            validationRules
                        );
                        break;

                    default:
                        // Use the flexible middleware system
                        const middlewareFunction = webSocketMiddleware.getMiddleware(middlewareName);
                        middlewareResult = await middlewareFunction(socket, data);
                        break;
                }

                if (!middlewareResult.success) {
                    return {
                        success: false,
                        error: middlewareResult.error
                    };
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes('Unknown middleware')) {
                    logger.warn(`Unknown middleware: ${middlewareName}`);
                    continue; // Skip unknown middleware
                }

                logger.error(`Error in middleware ${middlewareName}:`, error);
                return {
                    success: false,
                    error: {
                        message: `Middleware error: ${middlewareName}`,
                        code: 'MIDDLEWARE_ERROR'
                    }
                };
            }
        }

        return { success: true };
    }

    /**
     * Get all registered routes (for debugging/monitoring)
     */
    static getRegisteredRoutes(): string[] {
        return Object.keys(socketRoutes);
    }
}