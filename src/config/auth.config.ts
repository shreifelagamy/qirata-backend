import { betterAuth } from "better-auth";
import { openAPI } from 'better-auth/plugins';
import { Pool } from "pg";

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

    // Secret for session management and CSRF protection
    secret: process.env.BETTER_AUTH_SECRET || "your-super-secret-key-change-in-production",

    // Base URL for redirects and cookie domain
    baseURL: process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000',

    // Enable email/password authentication
    emailAndPassword: {
        enabled: true,
        autoSignIn: true, // Automatically sign in users after registration
        requireEmailVerification: false, // Set to true if you want email verification
    },

    // Session configuration
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
        updateAge: 60 * 60 * 24, // 1 day - session will be updated if it's older than this
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60 * 1000, // 5 minutes in milliseconds
        }
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

    // Enhanced cookie configuration for security
    advanced: {
        useSecureCookies: process.env.NODE_ENV === 'production',
        cookiePrefix: process.env.COOKIE_PREFIX || "better-auth",
        defaultCookieAttributes: {
            sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            domain: process.env.COOKIE_DOMAIN || undefined, // Allow cross-subdomain cookies if needed
        },
        // Additional security options
        crossSubDomainCookies: {
            enabled: process.env.ENABLE_CROSS_SUBDOMAIN === 'true',
            domain: process.env.COOKIE_DOMAIN || undefined,
        }
    },

    plugins: [
        openAPI(), // Keep OpenAPI documentation plugin
    ]
});

