/**
 * @fileoverview Mastra Memory Integration for Cloudflare Workers
 *
 * Integrates Mastra's memory system with Cloudflare Workers environment.
 * Provides persistent conversation memory using D1, KV, or Durable Objects.
 *
 * Features:
 * - Multi-storage backend support (D1, KV, Durable Objects)
 * - Thread-based conversation management
 * - Resource scoping for multi-user scenarios
 * - Cloudflare Workers optimized (edge-ready)
 * - Compatible with existing MemoryAgent architecture
 *
 * @see https://docs.mastra.ai/core/memory
 */
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { IMemoryStorage } from './storage/storage-interface';
import type { MemoryRecord, MemoryType, MemorySearchOptions, MemoryUpdate } from './types';
/**
 * Cloudflare Workers environment bindings
 */
export interface CloudflareEnv {
    DB?: D1Database;
    KV?: KVNamespace;
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GROQ_API_KEY?: string;
}
/**
 * Storage backend types for Mastra memory
 */
export type MastraStorageBackend = 'memory' | 'd1' | 'kv';
/**
 * Configuration for Mastra memory integration
 */
export interface MastraMemoryConfig {
    /** Storage backend (memory, d1, or kv) */
    storage: MastraStorageBackend;
    /** Cloudflare environment bindings */
    env?: CloudflareEnv;
    /** D1 table name (for d1 storage) */
    tableName?: string;
    /** KV key prefix (for kv storage) */
    kvPrefix?: string;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * D1-based storage adapter for Mastra Memory
 * Implements IMemoryStorage using Cloudflare D1
 */
export declare class MastraD1MemoryStorage implements IMemoryStorage {
    private db;
    private tableName;
    constructor(db: D1Database, tableName?: string);
    /**
     * Initialize D1 schema for Mastra memory
     */
    initSchema(): Promise<void>;
    insertMemory(userId: string, memoryType: MemoryType, content: string, importance: number, metadata?: Record<string, any>): Promise<string>;
    findMemories(userId: string, query?: string, limit?: number, options?: MemorySearchOptions): Promise<MemoryRecord[]>;
    findSimilarMemories(userId: string, content: string, limit?: number): Promise<MemoryRecord[]>;
    updateMemory(id: string, updates: MemoryUpdate): Promise<void>;
    deleteMemory(id: string): Promise<void>;
    getMemoryById(id: string): Promise<MemoryRecord | null>;
    batchUpdateMemories(updates: Array<{
        id: string;
        updates: MemoryUpdate;
    }>): Promise<void>;
}
/**
 * KV-based storage adapter for Mastra Memory
 * Uses Cloudflare KV for simple key-value storage
 */
export declare class MastraKVMemoryStorage implements IMemoryStorage {
    private kv;
    private prefix;
    constructor(kv: KVNamespace, prefix?: string);
    private getUserKey;
    private getMemoryKey;
    insertMemory(userId: string, memoryType: MemoryType, content: string, importance: number, metadata?: Record<string, any>): Promise<string>;
    findMemories(userId: string, query?: string, limit?: number, options?: MemorySearchOptions): Promise<MemoryRecord[]>;
    findSimilarMemories(userId: string, content: string, limit?: number): Promise<MemoryRecord[]>;
    updateMemory(id: string, updates: MemoryUpdate): Promise<void>;
    deleteMemory(id: string): Promise<void>;
    getMemoryById(id: string): Promise<MemoryRecord | null>;
    batchUpdateMemories(updates: Array<{
        id: string;
        updates: MemoryUpdate;
    }>): Promise<void>;
}
/**
 * Mastra Memory Manager for Cloudflare Workers
 * Wraps Mastra's memory system with Cloudflare-compatible storage
 */
export declare class MastraMemoryManager {
    private mastra;
    private storage;
    private config;
    constructor(config: MastraMemoryConfig);
    /**
     * Initialize Mastra instance with memory
     */
    initialize(): Promise<Mastra>;
    /**
     * Get storage instance (for direct access)
     */
    getStorage(): IMemoryStorage;
    /**
     * Create an agent with memory
     */
    createAgent(config: {
        id: string;
        name: string;
        instructions: string;
        model: any;
        tools?: Record<string, any>;
        userId: string;
        threadId?: string;
        resourceId?: string;
    }): Promise<Agent>;
    /**
     * Store a message in memory
     */
    storeMessage(userId: string, threadId: string, role: 'user' | 'assistant', content: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * Recall conversation history
     */
    recallConversation(userId: string, threadId: string, limit?: number): Promise<Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>>;
    /**
     * Get relevant context for a query
     */
    getRelevantContext(userId: string, query: string, limit?: number): Promise<string>;
}
/**
 * Quick helper to create Mastra memory manager for Cloudflare Workers
 *
 * @example
 * ```ts
 * const memoryManager = createMastraMemory({
 *   storage: 'd1',
 *   env: env, // Cloudflare env bindings
 * });
 *
 * const agent = await memoryManager.createAgent({
 *   id: 'assistant',
 *   name: 'AI Assistant',
 *   instructions: 'Help users with their questions',
 *   model: openai('gpt-4o'),
 *   userId: 'user-123',
 *   threadId: 'conversation-1',
 * });
 * ```
 */
export declare function createMastraMemory(config: MastraMemoryConfig): MastraMemoryManager;
