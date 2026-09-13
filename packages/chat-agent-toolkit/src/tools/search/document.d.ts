/**
 * @module research/search/document
 * @description Minimal document shape shared across the search pipeline.
 * A document is a chunk of page content plus citation metadata (title, url, source, etc.).
 */
export interface Document<Metadata extends Record<string, any> = Record<string, any>> {
    pageContent: string;
    metadata: Metadata;
}
/**
 * Splits text into overlapping chunks on whitespace boundaries.
 * Default chunkSize 1000, chunkOverlap 200.
 */
export declare function splitTextIntoChunks(text: string, chunkSize?: number, chunkOverlap?: number): string[];
