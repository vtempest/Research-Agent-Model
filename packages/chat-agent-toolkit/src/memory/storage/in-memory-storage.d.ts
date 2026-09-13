/**
 * Simple Memory Class
 *
 * Core memory management functionality with:
 * - Message deduplication
 * - Automatic summarization
 * - Vector-based relevance search
 * - Caching with TTL
 * - Batch processing
 * - Conflict resolution
 */
import type { IMemoryStorage } from "./storage-interface";
import type { MemoryRecord, MemorySearchOptions, MemoryMetrics, MemoryOptions, MemoryContextOptions, MemoryType } from "../types";
export declare class SimpleMemory {
    private userId;
    private storage;
    private maxMemories;
    private summaryThreshold;
    private cacheExpiry;
    private batchSize;
    private relevanceThreshold;
    private enableVectorSearch;
    private enableAutoSummarization;
    private recentMessages;
    private memoryCache;
    private isProcessing;
    private processingQueue;
    private summarizeTimeout?;
    private metrics;
    /**
     * Initialize memory system for a user
     */
    constructor(userId: string, storage: IMemoryStorage, options?: MemoryOptions);
    /**
     * Add a message to current session with intelligent deduplication
     */
    addMessage(role: "user" | "assistant", content: string, metadata?: Record<string, any>): boolean;
    /**
     * Debounced summarization to prevent excessive processing
     */
    private debouncedSummarize;
    /**
     * Store important facts with validation and conflict resolution
     */
    storeFact(content: string, importance?: number, category?: MemoryType, metadata?: Record<string, any>): Promise<string>;
    /**
     * Find similar facts using content similarity
     */
    private findSimilarFacts;
    /**
     * Enhanced memory recall with caching and vector search
     */
    recallRelevantMemories(query?: string, limit?: number, options?: MemorySearchOptions): Promise<MemoryRecord[]>;
    /**
     * Apply vector search to memories
     */
    private applyVectorSearch;
    /**
     * Update relevance scores for memories
     */
    private updateRelevanceScores;
    /**
     * Improved summarization with error handling and batch processing
     */
    summarizeAndStore(): Promise<boolean>;
    /**
     * Extract facts from conversation using LLM
     */
    private extractFactsFromConversation;
    /**
     * Process facts in batches to avoid overwhelming the database
     */
    private processFactsInBatches;
    /**
     * Clear cache utility
     */
    clearCache(): void;
    /**
     * Get memory context with better formatting and relevance
     */
    getMemoryContext(query?: string, includeRecent?: boolean, options?: MemoryContextOptions): Promise<string>;
    /**
     * Get performance metrics
     */
    getMetrics(): MemoryMetrics;
}
