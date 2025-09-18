import { betterAuth } from "better-auth";
import { bearer, jwt, openAPI } from 'better-auth/plugins';
import { Pool } from "pg";
import { jwtVerify, createRemoteJWKSet } from 'jose';

import dotenv from 'dotenv';
import { logger } from "../utils/logger";

dotenv.config();

// Create PostgreSQL connection pool for better-auth
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const auth = betterAuth({
    database: pool,

    // JWT Configuration for token-based authentication
    secret: process.env.BETTER_AUTH_SECRET || "your-super-secret-jwt-key-change-in-production",

    // Enable email/password authentication
    emailAndPassword: {
        enabled: true,
    },

    logger: {
        disabled: false,
        level: "error",
        log: (level: string, message: string, ...args: any[]) => {
            // Custom logging implementation
            logger.debug(`[${level}] ${message}`);
        }
    },

    onAPIError: {
        throw: true,
        onError(error: any, ctx: any) {
            console.log("Error :", error)
        },
    },

    trustedOrigins: [
        "http://localhost:5173",   // Vite dev
        "http://localhost:3000",   // your API host
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []), // Production frontend from env
        ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',') : []) // Additional trusted origins from env
    ],

    // Advanced cookie configuration for cross-origin support
    advanced: {
        useSecureCookies: process.env.NODE_ENV === 'production', // false for localhost development
        defaultCookieAttributes: {
            sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax", // lax for localhost, none for production
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // false for localhost development
        }
    },

    plugins: [
        openAPI(),
        bearer({ requireSignature: true }),
        jwt({
            jwt: {
                issuer: process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000',
                audience: process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000',
                // Optional: add claims you care about
                definePayload: ({ user, session }) => ({
                    sub: user.id,
                    email: user.email,
                    name: user.name,
                    sid: session.id,
                    // add roles/permissions if you have them
                }),
            }
        })
    ]
});

/**
 * Validates JWT token using Better Auth's JWKS endpoint
 * @param token - JWT token to validate
 * @returns JWT payload if valid, null if invalid
 */
export const validateToken = async (token: string) => {
    try {
        const backendUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000';
        const JWKS = createRemoteJWKSet(
            new URL(`${backendUrl}/api/auth/jwks`)
        );
        
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: backendUrl,
            audience: backendUrl
        });
        
        return payload;
    } catch (error) {
        logger.error('JWT validation failed:', error);
        return null;
    }
};