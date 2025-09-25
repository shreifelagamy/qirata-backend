import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Request, Response } from 'express';
import { auth } from '../config/auth.config';

// Extend Express Request type to include user from better-auth
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
            };
            session?: {
                id: string;
            };
        }
    }
}

/**
 * Authentication middleware for cookie-based authentication using Better Auth
 * Verifies session cookies and extracts user information
 * Supports token in query parameter for SSE endpoints where cookies might not be available
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get session using Better Auth's getSession (handles cookies automatically)
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });

        if (session?.user) {
            req.user = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name
            };
            req.session = {
                id: session.session.id
            };
            return next();
        }

        // For SSE endpoints or special cases, allow session token in query parameter
        const tokenFromQuery = req.query.token as string;
        if (tokenFromQuery) {
            try {
                // Create a temporary headers object with the session token as a cookie
                const tempHeaders = {
                    ...req.headers,
                    cookie: `better-auth.session_token=${tokenFromQuery}` // Using default cookie name
                };

                const sessionFromToken = await auth.api.getSession({
                    headers: fromNodeHeaders(tempHeaders)
                });

                if (sessionFromToken?.user) {
                    req.user = {
                        id: sessionFromToken.user.id,
                        email: sessionFromToken.user.email,
                        name: sessionFromToken.user.name
                    };
                    req.session = {
                        id: sessionFromToken.session.id
                    };
                    return next();
                }
            } catch (tokenError) {
                // If token from query fails, continue to unauthorized response
                console.error('Token from query validation failed:', tokenError);
            }
        }

        // No valid session found
        res.status(401).json({
            error: "UNAUTHORIZED",
            message: "No valid session found. Please sign in."
        });
        return;

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Authentication error occurred."
        });
        return;
    }
};
