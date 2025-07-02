import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface DebugCallbackOptions {
    outputDir?: string;
    agentName: string;
    sessionId?: string;
}

export class DebugCallback extends BaseCallbackHandler {
    name = "debug";
    private outputDir: string;
    private agentName: string;
    private sessionId: string;

    constructor(options: DebugCallbackOptions) {
        super();
        this.outputDir = options.outputDir || './debug-logs';
        this.agentName = options.agentName;
        this.sessionId = options.sessionId || 'default';

        // Ensure output directory exists
        this.ensureOutputDir();
    }

    private ensureOutputDir(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private getLogFilePath(type: 'prompt' | 'response'): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${this.agentName}-${type}-${this.sessionId}-${timestamp}.txt`;
        return path.join(this.outputDir, filename);
    }

    private writeToFile(filePath: string, content: string): void {
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            logger.debug(`Debug log written to: ${filePath}`);
        } catch (error) {
            logger.error('Failed to write debug log:', error);
        }
    }

    async handleChatModelStart(llm: any, messages: any[][]): Promise<void> {
        try {
            const debugContent = this.formatPromptDebug(messages);
            const filePath = this.getLogFilePath('prompt');
            this.writeToFile(filePath, debugContent);
        } catch (error) {
            logger.error('Error in handleChatModelStart:', error);
        }
    }

    async handleLLMEnd(output: any): Promise<void> {
        try {
            const responseContent = this.formatResponseDebug(output);
            const filePath = this.getLogFilePath('response');
            this.writeToFile(filePath, responseContent);
        } catch (error) {
            logger.error('Error in handleLLMEnd:', error);
        }
    }

    private formatPromptDebug(messages: any[][]): string {
        const timestamp = new Date().toISOString();
        let content = `🔍 === PROMPT DEBUG ===\n`;
        content += `Agent: ${this.agentName}\n`;
        content += `Session: ${this.sessionId}\n`;
        content += `Timestamp: ${timestamp}\n`;
        content += `========================\n\n`;

        if (messages && messages[0]) {
            messages[0].forEach((msg: any, i: number) => {
                const role = msg.constructor?.name?.replace('Message', '') || 'Unknown';
                content += `[${i + 1}] ${role}:\n`;
                content += `${msg.content}\n`;
                content += `---\n\n`;
            });
        } else {
            content += 'No messages found\n';
        }

        content += `======================\n`;
        return content;
    }

    private formatResponseDebug(output: any): string {
        const timestamp = new Date().toISOString();
        let content = `✅ === RESPONSE DEBUG ===\n`;
        content += `Agent: ${this.agentName}\n`;
        content += `Session: ${this.sessionId}\n`;
        content += `Timestamp: ${timestamp}\n`;
        content += `=========================\n\n`;

        try {
            if (output?.generations?.[0]?.text) {
                content += `Response Text:\n${output.generations[0].text}\n\n`;
            } else if (output?.content) {
                content += `Response Content:\n${output.content}\n\n`;
            } else {
                content += `Full Output:\n${JSON.stringify(output, null, 2)}\n\n`;
            }
        } catch (error) {
            content += `Error parsing output: ${error}\n`;
            content += `Raw output: ${output}\n`;
        }

        content += `=========================\n`;
        return content;
    }
}

/**
 * Create a debug callback for an agent
 */
export function createDebugCallback(agentName: string, sessionId?: string, outputDir?: string): DebugCallback {
    return new DebugCallback({
        agentName,
        sessionId,
        outputDir
    });
}