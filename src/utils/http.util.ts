import { URL } from 'url';
import { logger } from './logger';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

interface ErrorResponse {
    message?: string;
    error?: string;
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds

export interface FetchOptions extends AxiosRequestConfig {
    timeout?: number;
    retries?: number;
    responseType?: 'json' | 'text' | 'arraybuffer' | 'document' | 'stream';
    headers?: {
        [key: string]: string;
    };
}

export interface FetchWithHeadersResponse<T = any> {
    data: T;
    headers: Record<string, string>;
    status: number;
}

export async function fetchWithTimeout<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = 3, ...axiosOptions } = options;
    let lastError: AxiosError<ErrorResponse> | Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios<T>({
                url,
                timeout,
                ...axiosOptions,
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                lastError = error as AxiosError<ErrorResponse>;
            } else if (error instanceof Error) {
                lastError = error;
            } else {
                lastError = new Error('Unknown error occurred');
            }
            if (attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw handleHttpErrors(lastError);
}

/**
 * Fetch with timeout and return full response including headers
 * Useful for conditional requests (ETag, Last-Modified)
 */
export async function fetchWithHeaders<T = any>(url: string, options: FetchOptions = {}): Promise<FetchWithHeadersResponse<T>> {
    const { timeout = DEFAULT_TIMEOUT, retries = 3, ...axiosOptions } = options;
    let lastError: AxiosError<ErrorResponse> | Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios<T>({
                url,
                timeout,
                validateStatus: (status) => status < 500, // Don't throw on 304 Not Modified
                ...axiosOptions,
            });

            return {
                data: response.data,
                headers: response.headers as Record<string, string>,
                status: response.status
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                lastError = error as AxiosError<ErrorResponse>;
            } else if (error instanceof Error) {
                lastError = error;
            } else {
                lastError = new Error('Unknown error occurred');
            }
            if (attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw handleHttpErrors(lastError);
}

export function validateUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (error) {
        return false;
    }
}

export function handleHttpErrors(error: any): Error {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ErrorResponse>;
        const status = axiosError.response?.status;
        const message = axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message;

        logger.error(`HTTP Error: ${status} - ${message}`, {
            error: axiosError.toJSON(),
            url: axiosError.config?.url,
        });

        switch (status) {
            case 403:
                return new Error('Access to this website is blocked. The site may have anti-bot protection. Please try providing the RSS feed URL directly.');
            case 404:
                return new Error('Resource not found');
            case 429:
                return new Error('Rate limit exceeded');
            case 500:
                return new Error('Internal server error');
            case undefined:
                if (axiosError.code === 'ECONNABORTED') {
                    return new Error('Request timeout');
                }
                return new Error('Network error');
            default:
                return new Error(`HTTP error ${status}: ${message}`);
        }
    }

    return error instanceof Error ? error : new Error('Unknown error occurred');
}