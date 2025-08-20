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
        log: (level, message, ...args) => {
            // Custom logging implementation
            logger.debug(`[${level}] ${message}`);
        }
    },

    onAPIError: {
        throw: true,
        onError(error, ctx) {
            console.log("Error :", error)
        },
    },

    trustedOrigins: [
        "http://localhost:5173",   // Vite dev
        "http://localhost:3000",   // your API host (optional)
    ],

    plugins: [
        openAPI(),
        bearer({ requireSignature: true }),
        jwt({
            jwt: {
                issuer: 'http://localhost:3000',
                audience: 'http://localhost:3000',
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
        const JWKS = createRemoteJWKSet(
            new URL(`${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/jwks`)
        );
        
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: process.env.BASE_URL || 'http://localhost:3000',
            audience: process.env.BASE_URL || 'http://localhost:3000'
        });
        
        return payload;
    } catch (error) {
        logger.error('JWT validation failed:', error);
        return null;
    }
};