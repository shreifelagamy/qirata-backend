import { Request, Response } from 'express';

/**
 * Server-Sent Events (SSE) response helper.
 * Wraps Express response to provide a clean API for streaming events.
 */
export class SSEResponse {
    private disconnected = false;

    constructor(private res: Response, req: Request) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        req.on('close', () => {
            this.disconnected = true;
        });
    }

    /**
     * Check if client is still connected.
     */
    isConnected(): boolean {
        return !this.disconnected && !this.res.writableEnded;
    }

    /**
     * Safe write that checks connection before writing.
     * @returns true if written successfully, false if client disconnected
     */
    private safeWrite(data: string): boolean {
        if (!this.isConnected()) {
            return false;
        }

        try {
            this.res.write(data);
            return true;
        } catch {
            this.disconnected = true;
            return false;
        }
    }

    /**
     * Send an event to the client.
     * @returns true if sent successfully, false if client disconnected
     */
    send(event: string, data: object): boolean {
        if (!this.isConnected()) {
            return false;
        }

        const success = this.safeWrite(`event: ${event}\n`);
        if (!success) return false;

        return this.safeWrite(`data: ${JSON.stringify(data)}\n\n`);
    }

    /**
     * Send an error event and end the connection.
     */
    sendError(error: string): void {
        this.send('error', { error });
        this.end();
    }

    /**
     * End the SSE connection.
     */
    end(): void {
        if (!this.res.writableEnded) {
            this.res.end();
        }
    }
}
