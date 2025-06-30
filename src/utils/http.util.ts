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