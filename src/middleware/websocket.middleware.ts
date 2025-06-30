import { AuthenticatedSocket } from '../types/socket.types';
import { logger } from '../utils/logger';

/**
 * WebSocket Middleware Collection
 * Provides middleware functions for WebSocket route processing with flexible validation
 */

export interface MiddlewareResult {
  success: boolean;
  error?: {
    message: string;
    code: string;
  };
}

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

/**
 * Rate limiting store for WebSocket connections
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class WebSocketMiddleware {
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_AUTHENTICATED = 100; // 100 requests per minute for authenticated users
  private readonly MAX_REQUESTS_UNAUTHENTICATED = 20; // 20 requests per minute for unauthenticated users

  /**
   * Authentication middleware
   * Checks if the socket is authenticated
   */
  async auth(socket: AuthenticatedSocket, data: any): Promise<MiddlewareResult> {
    try {
      if (!socket.data.isAuthenticated) {
        logger.warn(`Unauthenticated WebSocket request from ${socket.id}`);
        return {
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          }
        };
      }

      // Update last activity
      socket.data.lastActivity = new Date();

      return { success: true };
    } catch (error) {
      logger.error('Error in auth middleware:', error);
      return {
        success: false,
        error: {
          message: 'Authentication check failed',
          code: 'AUTH_ERROR'
        }
      };
    }
  }

  /**
   * Rate limiting middleware
   * Limits requests per minute based on authentication status
   */
  async rateLimit(socket: AuthenticatedSocket, data: any): Promise<MiddlewareResult> {
    try {
      const key = socket.data.userId || socket.id;
      const now = Date.now();
      const maxRequests = socket.data.isAuthenticated
        ? this.MAX_REQUESTS_AUTHENTICATED
        : this.MAX_REQUESTS_UNAUTHENTICATED;

      // Get or create rate limit entry
      let entry = this.rateLimitStore.get(key);

      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired entry
        entry = {
          count: 1,
          resetTime: now + this.RATE_LIMIT_WINDOW
        };
        this.rateLimitStore.set(key, entry);
        return { success: true };
      }

      // Check if limit exceeded
      if (entry.count >= maxRequests) {
        const resetIn = Math.ceil((entry.resetTime - now) / 1000);
        logger.warn(`Rate limit exceeded for ${key}, reset in ${resetIn}s`);

        return {
          success: false,
          error: {
            message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
            code: 'RATE_LIMIT_EXCEEDED'
          }
        };
      }

      // Increment counter
      entry.count++;
      this.rateLimitStore.set(key, entry);

      return { success: true };
    } catch (error) {
      logger.error('Error in rate limit middleware:', error);
      return { success: true }; // Allow on error to avoid blocking legitimate requests
    }
  }

  /**
   * Flexible validation middleware
   * Validates request data based on rules passed from routes
   */
  async validation(socket: AuthenticatedSocket, data: any, validationRules?: ValidationRule[]): Promise<MiddlewareResult> {
    try {
      if (!validationRules || validationRules.length === 0) {
        return { success: true };
      }

      for (const rule of validationRules) {
        const value = this.getNestedValue(data, rule.field);
        const validationResult = this.validateField(value, rule, rule.field);

        if (!validationResult.valid) {
          return {
            success: false,
            error: {
              message: validationResult.message,
              code: 'VALIDATION_ERROR'
            }
          };
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error in validation middleware:', error);
      return {
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR'
        }
      };
    }
  }

  /**
   * Validate individual field based on rule
   */
  private validateField(value: any, rule: ValidationRule, fieldPath: string): { valid: boolean; message: string } {
    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      return {
        valid: false,
        message: `Field '${fieldPath}' is required`
      };
    }

    // Skip validation if field is not required and empty
    if (!rule.required && (value === undefined || value === null)) {
      return { valid: true, message: '' };
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return {
        valid: false,
        message: `Field '${fieldPath}' must be of type ${rule.type}, got ${actualType}`
      };
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return {
          valid: false,
          message: `Field '${fieldPath}' must be at least ${rule.minLength} characters long`
        };
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          valid: false,
          message: `Field '${fieldPath}' must not exceed ${rule.maxLength} characters`
        };
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return {
          valid: false,
          message: `Field '${fieldPath}' does not match required pattern`
        };
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return {
          valid: false,
          message: `Field '${fieldPath}' must be at least ${rule.min}`
        };
      }

      if (rule.max !== undefined && value > rule.max) {
        return {
          valid: false,
          message: `Field '${fieldPath}' must not exceed ${rule.max}`
        };
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (typeof customResult === 'string') {
        return {
          valid: false,
          message: customResult
        };
      }
      if (!customResult) {
        return {
          valid: false,
          message: `Field '${fieldPath}' failed custom validation`
        };
      }
    }

    return { valid: true, message: '' };
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Logging middleware
   * Logs WebSocket events for monitoring and debugging
   */
  async logging(socket: AuthenticatedSocket, data: any): Promise<MiddlewareResult> {
    try {
      const logData = {
        socketId: socket.id,
        userId: socket.data.userId,
        timestamp: new Date().toISOString(),
        dataSize: JSON.stringify(data || {}).length
      };

      logger.debug('WebSocket middleware processed', logData);
      return { success: true };
    } catch (error) {
      logger.error('Error in logging middleware:', error);
      return { success: true }; // Don't block on logging errors
    }
  }

  /**
   * Cleanup expired rate limit entries
   * Called periodically to prevent memory leaks
   */
  cleanupRateLimitStore(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get middleware function by name
   */
  getMiddleware(name: string): (socket: AuthenticatedSocket, data: any, options?: any) => Promise<MiddlewareResult> {
    switch (name) {
      case 'auth':
        return this.auth.bind(this);
      case 'rateLimit':
        return this.rateLimit.bind(this);
      case 'validation':
        return this.validation.bind(this);
      case 'logging':
        return this.logging.bind(this);
      default:
        throw new Error(`Unknown middleware: ${name}`);
    }
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats(): { totalEntries: number; activeConnections: number } {
    const now = Date.now();
    let activeConnections = 0;

    for (const entry of this.rateLimitStore.values()) {
      if (now <= entry.resetTime) {
        activeConnections++;
      }
    }

    return {
      totalEntries: this.rateLimitStore.size,
      activeConnections
    };
  }
}

// Export singleton instance
export const webSocketMiddleware = new WebSocketMiddleware();

// Cleanup rate limit store every 5 minutes
setInterval(() => {
  webSocketMiddleware.cleanupRateLimitStore();
}, 5 * 60 * 1000);