/**
 * Memory System Types and Constants
 *
 * Defines interfaces and configuration for the memory management system
 */
/**
 * Memory types for categorization
 */
export declare const MEMORY_TYPES: {
    readonly FACT: "fact";
    readonly CONVERSATION: "conversation";
    readonly PREFERENCE: "preference";
    readonly PERSONAL: "personal";
    readonly WORK: "work";
    readonly MANUAL: "manual";
};
export type MemoryType = (typeof MEMORY_TYPES)[keyof typeof MEMORY_TYPES];
/**
 * Configuration constants for memory management
 */
export declare const MEMORY_CONFIG: {
    readonly DEFAULT_MAX_MEMORIES: 100;
    readonly DEFAULT_SUMMARY_THRESHOLD: 10;
    readonly DEFAULT_CACHE_EXPIRY: number;
    readonly DEFAULT_BATCH_SIZE: 5;
    readonly DEFAULT_RELEVANCE_THRESHOLD: 0.3;
    readonly DEFAULT_IMPORTANCE_RANGE: {
        readonly min: 0;
        readonly max: 10;
    };
    readonly DEFAULT_RATE_LIMIT: {
        readonly requests: 10;
        readonly windowMs: 60000;
    };
    readonly DEFAULT_TIMEOUT: 30000;
    readonly VECTOR_SEARCH_ENABLED: true;
    readonly AUTO_SUMMARIZATION_ENABLED: true;
};
/**
 * Memory record structure
 */
export interface MemoryRecord {
    id: string;
    user_id: string;
    memory_type: MemoryType;
    content: string;
    importance: number;
    access_count: number;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    relevance_score?: number;
}
/**
 * Message structure for conversation tracking
 */
export interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
/**
 * Memory search options
 */
export interface MemorySearchOptions {
    minImportance?: number;
    memoryType?: MemoryType;
    includeMetadata?: boolean;
}
/**
 * Memory update payload
 */
export interface MemoryUpdate {
    importance?: number;
    access_count?: number | {
        increment: number;
    };
    updated_at?: Date;
    metadata?: Record<string, any>;
}
/**
 * Memory context options
 */
export interface MemoryContextOptions {
    maxMemories?: number;
    minImportance?: number;
}
/**
 * Performance metrics
 */
export interface MemoryMetrics {
    cacheHits: number;
    cacheMisses: number;
    vectorSearches: number;
    summarizations: number;
    errors: number;
    cacheSize: number;
    recentMessagesCount: number;
    isProcessing: boolean;
}
/**
 * Memory initialization options
 */
export interface MemoryOptions {
    maxMemories?: number;
    summaryThreshold?: number;
    cacheExpiry?: number;
    batchSize?: number;
    relevanceThreshold?: number;
    enableVectorSearch?: boolean;
    enableAutoSummarization?: boolean;
}
/**
 * Extracted fact structure
 */
export interface ExtractedFact {
    content: string;
    importance?: number;
    category?: MemoryType;
    metadata?: Record<string, any>;
}
