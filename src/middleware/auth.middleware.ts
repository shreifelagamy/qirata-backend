import { fromNodeHeaders } from 'better-auth/node';
import { NextFunction, Request, Response } from 'express';
import { auth, validateToken } from '../config/auth.config';

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
 * Authentication middleware to verify JWT tokens from better-auth
 * Supports multiple authentication methods:
 * 1. Better Auth session cookies (priority)
 * 2. Bearer token in Authorization header
 * 3. Token in query parameter (for SSE endpoints where headers cannot be set)
 * Extracts user information and attaches it to the request object
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // First try to get session using Better Auth's getSession (handles cookies)
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

        // If no session from cookies, try JWT Bearer token from header or query parameter
        const authHeader = req.headers.authorization;
        const tokenFromQuery = req.query.token as string;
        
        let token: string | null = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        } else if (tokenFromQuery) {
            // For SSE endpoints where headers cannot be set, allow token via query parameter
            token = tokenFromQuery;
        }
        
        if (!token) {
            res.setHeader("WWW-Authenticate", 'Bearer realm="qirata", error="invalid_token"');
            res.status(401).json({ error: "UNAUTHORIZED" });
            return;
        }
        const payload = await validateToken(token);

        if (!payload) {
            res.setHeader("WWW-Authenticate", 'Bearer realm="qirata", error="invalid_token"');
            res.status(401).json({ error: "UNAUTHORIZED" });
            return;
        }

        // Extract user data from JWT payload
        req.user = {
            id: payload.sub as string,
            email: payload.email as string,
            name: payload.name as string
        };
        req.session = {
            id: payload.sid as string
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.setHeader("WWW-Authenticate", 'Bearer realm="qirata", error="invalid_token"');
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
    }
};
