import type { ToolSet } from "ai";
export interface QwkSearchMCPConfig {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
}
/**
 * Long-lived MCP session for QwkSearch tools.
 * Spawns a local MCP server process and keeps it alive across tool calls.
 */
export declare class QwkSearchMCPSession {
    private client;
    private config;
    constructor(config?: QwkSearchMCPConfig);
    getTools(): Promise<ToolSet>;
    close(): Promise<void>;
}
/**
 * One-shot helper to get QwkSearch MCP tools.
 * Creates a session, fetches tools, and returns them.
 * Caller should close the returned session when done.
 */
export declare function getQwkSearchTools(config?: QwkSearchMCPConfig): Promise<{
    tools: ToolSet;
    session: QwkSearchMCPSession;
}>;
