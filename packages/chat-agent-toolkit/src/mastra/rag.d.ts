/**
 * @fileoverview Mastra RAG (Retrieval-Augmented Generation)
 *
 * Document processing, chunking, embedding, and vector-store retrieval.
 * Uses Vercel AI SDK embeddings with pluggable vector backends.
 */
export interface RAGConfig {
    embeddingModel: any;
    chunkSize?: number;
    chunkOverlap?: number;
    topK?: number;
}
export interface RAGDocument {
    id: string;
    content: string;
    metadata?: Record<string, any>;
}
export interface RAGChunk {
    id: string;
    documentId: string;
    text: string;
    embedding: number[];
    metadata?: Record<string, any>;
}
export interface RAGRetrievalResult {
    chunk: RAGChunk;
    score: number;
}
/**
 * In-memory RAG pipeline with document chunking, embedding, and retrieval.
 * For production, swap the vector store with Pinecone, Qdrant, or pgvector.
 *
 * @example
 * ```ts
 * import { MastraRAG } from "chat-agent-toolkit/mastra";
 * import { openai } from "@ai-sdk/openai";
 *
 * const rag = new MastraRAG({
 *   embeddingModel: openai.embedding("text-embedding-3-small"),
 *   chunkSize: 512,
 *   topK: 5,
 * });
 *
 * await rag.ingest([
 *   { id: "doc1", content: "Long document text..." },
 * ]);
 *
 * const results = await rag.retrieve("What is the main topic?");
 * ```
 */
export declare class MastraRAG {
    private config;
    private chunks;
    constructor(config: RAGConfig);
    /**
     * Split text into overlapping chunks of configured size.
     */
    private splitIntoChunks;
    /**
     * Ingest documents: chunk, embed, and store.
     */
    ingest(documents: RAGDocument[]): Promise<number>;
    /**
     * Retrieve relevant chunks for a query using cosine similarity.
     */
    retrieve(query: string): Promise<RAGRetrievalResult[]>;
    /**
     * Retrieve and format context string for LLM consumption.
     */
    getContext(query: string): Promise<string>;
    /**
     * Get total chunk count in the store.
     */
    get size(): number;
    /**
     * Clear all stored chunks.
     */
    clear(): void;
}
/**
 * Factory for creating a configured RAG pipeline.
 */
export declare function createRAGPipeline(config: RAGConfig): MastraRAG;
