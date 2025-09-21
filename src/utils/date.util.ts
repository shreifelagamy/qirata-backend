import { logger } from './logger';

/**
 * Parses various date formats commonly found in RSS feeds
 * Handles Date objects, strings, and various formats like:
 * - Thu, 04 Sep 2025 16:26:16 GMT (RFC 822)
 * - 2025-05-29T00:00:00+00:00 (ISO 8601)
 * - And other common variations
 */
export function parseRSSDate(dateInput: Date | string | undefined | any): Date | undefined {
    if (!dateInput) {
        return undefined;
    }

    try {
        // If it's already a Date object, validate and return
        if (dateInput instanceof Date) {
            return !isNaN(dateInput.getTime()) ? dateInput : undefined;
        }

        // If it's a string, try parsing
        if (typeof dateInput === 'string') {
            // Try parsing as-is first (handles most ISO 8601 formats)
            let parsedDate = new Date(dateInput);

            // Check if the parsed date is valid
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
            }

            // Clean the date string and try parsing again
            const cleanedDate = dateInput.trim();
            parsedDate = new Date(cleanedDate);

            if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
            }

            // Log the unparseable date for debugging
            logger.warn(`Unable to parse RSS date: "${dateInput}"`);
            return undefined;
        }

        // Handle other types by converting to string first
        if (dateInput) {
            return parseRSSDate(String(dateInput));
        }

        return undefined;

    } catch (error) {
        logger.warn(`Error parsing RSS date: "${dateInput}"`, error);
        return undefined;
    }
}

/**
 * Converts a Date object to ISO string format for database storage
 */
export function formatDateForDatabase(date: Date | undefined): string | undefined {
    if (!date || isNaN(date.getTime())) {
        return undefined;
    }
    return date.toISOString();
}