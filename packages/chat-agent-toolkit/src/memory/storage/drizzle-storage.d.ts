/**
 * Drizzle Storage Adapter
 *
 * Implementation of IMemoryStorage using Drizzle ORM
 */
import type { IMemoryStorage } from "./storage-interface";
import type { MemoryRecord, MemoryType, MemorySearchOptions, MemoryUpdate } from "../types";
/**
 * The Drizzle table passed to {@link DrizzleMemoryStorage} must expose these
 * columns (see {@link createMemorySchema} for the expected shape).
 */
export interface MemoryTable {
    id: any;
    user_id: any;
    memory_type: any;
    content: any;
    importance: any;
    access_count: any;
    metadata: any;
    created_at: any;
    updated_at: any;
}
/**
 * Drizzle-based storage adapter.
 *
 * Pass the Drizzle database instance and the memory table object defined in
 * your schema (not a table-name string) so queries reference real columns:
 *
 * ```ts
 * import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
 * const userMemories = sqliteTable("user_memories", { ... });
 * const storage = new DrizzleMemoryStorage(db, userMemories);
 * ```
 */
export declare class DrizzleMemoryStorage implements IMemoryStorage {
    private db;
    private table;
    constructor(db: any, table: MemoryTable & Record<string, any>);
    /**
     * Insert a new memory record
     */
    insertMemory(userId: string, memoryType: MemoryType, content: string, importance: number, metadata?: Record<string, any>): Promise<string>;
    /**
     * Find memories by user ID and optional filters
     */
    findMemories(userId: string, query?: string, limit?: number, options?: MemorySearchOptions): Promise<MemoryRecord[]>;
    /**
     * Find similar memories based on content
     */
    findSimilarMemories(userId: string, content: string, limit?: number): Promise<MemoryRecord[]>;
    /**
     * Update a memory record
     */
    updateMemory(id: string, updates: MemoryUpdate): Promise<void>;
    /**
     * Delete a memory record
     */
    deleteMemory(id: string): Promise<void>;
    /**
     * Get memory by ID
     */
    getMemoryById(id: string): Promise<MemoryRecord | null>;
    /**
     * Batch update memories
     */
    batchUpdateMemories(updates: Array<{
        id: string;
        updates: MemoryUpdate;
    }>): Promise<void>;
}
/**
 * Database schema for memory system
 * This is kept here for reference but should be managed by your migration system
 */
export declare function createMemorySchema(db: any): {
    user_memories: {
        id: string;
        user_id: string;
        memory_type: string;
        content: string;
        importance: string;
        access_count: string;
        metadata: string;
        created_at: string;
        updated_at: string;
    };
};
