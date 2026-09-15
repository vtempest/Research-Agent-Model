/**
 * Memory Agent
 *
 * Enhanced Memory Agent with:
 * - Rate limiting
 * - Multiple LLM provider support
 * - Health monitoring
 * - Conversation management
 * - Memory analytics
 */
import type { IMemoryStorage } from "./storage/storage-interface";
import type { MemoryType, MemorySearchOptions } from "./types";
/**
 * LLM provider interface
 */
interface LLMProvider {
    invoke: (prompt: string) => Promise<{
        content: string;
        tokensUsed: number;
    }>;
}
/**
 * Chat options
 */
interface ChatOptions {
    provider?: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    includeHistory?: boolean;
    maxMemories?: number;
    minImportance?: number;
}
/**
 * Chat response
 */
interface ChatResponse {
    content?: string;
    memoryContext?: string;
    success: boolean;
    tokensUsed?: number;
    responseTime?: number;
    sessionId?: string;
    timestamp: string;
    error?: string;
}
/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    requests: number;
    windowMs: number;
}
/**
 * Agent options
 */
export interface MemoryAgentOptions {
    memoryOptions?: any;
    defaultProvider?: string;
    defaultApiKey?: string;
    defaultModel?: string;
    rateLimit?: RateLimitConfig;
    providers?: Record<string, (apiKey: string, model: string, temperature: number) => LLMProvider>;
}
export declare class MemoryAgent {
    private memory;
    private defaultProvider;
    private defaultApiKey?;
    private defaultModel?;
    private rateLimiter;
    private rateLimitConfig;
    private providers;
    private sessionId;
    private conversationHistory;
    private analytics;
    private userId;
    /**
     * Initialize memory agent
     */
    constructor(userId: string, storage: IMemoryStorage, options?: MemoryAgentOptions);
    /**
     * Get default LLM providers
     */
    private getDefaultProviders;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
    /**
     * Rate limiting check with sliding window
     */
    private checkRateLimit;
    /**
     * Main chat method with comprehensive error handling
     */
    chat(message: string, options?: ChatOptions): Promise<ChatResponse>;
    /**
     * Generate LLM response with timeout and error handling
     */
    private generateResponse;
    /**
     * Build enhanced prompt with context
     */
    private buildPrompt;
    /**
     * Update analytics
     */
    private updateAnalytics;
    /**
     * Remember a fact manually
     */
    remember(fact: string, importance?: number, category?: MemoryType, metadata?: Record<string, any>): Promise<string>;
    /**
     * Get memories with filtering
     */
    getMemories(query?: string, limit?: number, options?: MemorySearchOptions): Promise<any[]>;
    /**
     * Force store summary of current conversation
     */
    forceStoreSummary(): Promise<boolean>;
    /**
     * Health check for the agent
     */
    healthCheck(): Promise<any>;
    /**
     * Get analytics and performance metrics
     */
    getAnalytics(): any;
    /**
     * Reset session and clear conversation history
     */
    resetSession(): void;
}
export {};
