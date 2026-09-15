/**
 * Long-term Memory System for Multi-Agent Trading System
 * JavaScript port of Python memory.py
 *
 * Updated for LangChain JS and Google Gemini Embeddings (text-embedding-004)
 * Provides vector-based memory storage for financial debate history
 */

import { ChromaClient } from 'chromadb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from './config.js';
import { sanitizeTickerForCollection } from './utils.js';
import { GLOBAL_RATE_LIMITER } from './llms.js';
import path from 'path';
import fs from 'fs';

/**
 * FinancialSituationMemory class
 * Vector memory storage for financial agent debate history
 */
export class FinancialSituationMemory {
  constructor(name) {
    this.name = name;
    this.available = false;
    this.situationCollection = null;
    this.embeddings = null;
    this.chromaClient = null;

    this._initialize();
  }

  async _initialize() {
    // Check for API key
    const apiKey = config.getGoogleApiKey();
    if (!apiKey) {
      console.warn(`Memory disabled: GOOGLE_API_KEY not set (collection: ${this.name})`);
      return;
    }

    try {
      // Initialize Google embeddings
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        modelName: 'text-embedding-004',
        apiKey,
        taskType: 'RETRIEVAL_DOCUMENT',
      });

      // Test embeddings
      try {
        const testEmbedding = await this.embeddings.embedQuery('initialization test');
        if (!testEmbedding || testEmbedding.length === 0) {
          throw new Error('Embedding test returned empty result');
        }
      } catch (error) {
        console.warn(`Embedding initialization test failed: ${error.message}`);
      }

      console.log(`Embeddings initialized: text-embedding-004 (collection: ${this.name})`);
    } catch (error) {
      console.warn(`Embeddings init failed (${this.name}): ${error.message}`);
      return;
    }

    try {
      // Initialize ChromaDB client
      this.chromaClient = new ChromaClient({
        path: path.resolve(config.chromaPersistDirectory),
      });

      // Create or get collection
      const collections = await this.chromaClient.listCollections();
      const collectionExists = collections.some(c => c.name === this.name);

      if (collectionExists) {
        this.situationCollection = await this.chromaClient.getCollection({
          name: this.name,
        });
      } else {
        this.situationCollection = await this.chromaClient.createCollection({
          name: this.name,
          metadata: {
            description: `Financial debate memory for ${this.name}`,
            embedding_model: 'text-embedding-004',
            embedding_dimension: 768,
            created_at: new Date().toISOString(),
            version: '2.0',
          },
        });
      }

      this.available = true;

      // Log collection stats
      const count = await this.situationCollection.count();
      console.log(
        `ChromaDB initialized: ${this.name}, ` +
        `persist_dir: ${config.chromaPersistDirectory}, ` +
        `existing_documents: ${count}`
      );
    } catch (error) {
      console.warn(`ChromaDB init failed (${this.name}): ${error.message}`);
      this.available = false;
    }
  }

  /**
   * Get embedding vector for text with retry logic
   */
  async _getEmbedding(text) {
    if (!this.available || !this.embeddings) {
      throw new Error(`Memory not available for ${this.name}`);
    }

    // Truncate text to avoid token limits
    const truncatedText = text.substring(0, 9000);

    // Use rate limiter to share RPM quota with LLM calls
    try {
      await GLOBAL_RATE_LIMITER.acquire();
      const embedding = await this.embeddings.embedQuery(truncatedText);

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned');
      }

      return embedding;
    } catch (error) {
      // If rate limiter fails, try without it
      const embedding = await this.embeddings.embedQuery(truncatedText);

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned');
      }

      return embedding;
    }
  }

  /**
   * Add financial situations/debates to memory
   */
  async addSituations(situations, metadata = null) {
    if (!this.available) {
      console.debug(`Memory add skipped: ${this.name}`);
      return false;
    }

    if (!situations || situations.length === 0) {
      console.debug(`Empty situations list: ${this.name}`);
      return false;
    }

    try {
      // Generate embeddings for all situations
      const embeddings = [];
      for (const situation of situations) {
        const emb = await this._getEmbedding(situation);
        embeddings.push(emb);
      }

      // Prepare IDs (use timestamp + index)
      const timestamp = new Date().toISOString();
      const ids = situations.map((_, i) => `${timestamp}_${i}`);

      // Prepare metadata
      let finalMetadata;
      if (metadata === null) {
        finalMetadata = situations.map(() => ({ timestamp }));
      } else {
        finalMetadata = metadata.map(meta => ({
          ...meta,
          timestamp: meta.timestamp || timestamp,
        }));
      }

      // Add to collection
      await this.situationCollection.add({
        ids,
        embeddings,
        documents: situations,
        metadatas: finalMetadata,
      });

      console.log(
        `Situations added: ${this.name}, ` +
        `count: ${situations.length}, ` +
        `has_metadata: ${metadata !== null}`
      );

      return true;
    } catch (error) {
      console.error(`Add situations failed (${this.name}): ${error.message}`);
      return false;
    }
  }

  /**
   * Query for similar past situations
   */
  async querySimilarSituations(queryText, nResults = 5, metadataFilter = null) {
    if (!this.available) {
      console.debug(`Memory query skipped: ${this.name}`);
      return [];
    }

    try {
      // Get query embedding
      const queryEmbedding = await this._getEmbedding(queryText);

      // Query ChromaDB
      const queryParams = {
        queryEmbeddings: [queryEmbedding],
        nResults,
      };

      if (metadataFilter) {
        queryParams.where = metadataFilter;
      }

      const results = await this.situationCollection.query(queryParams);

      // Format results
      const formattedResults = [];
      if (results && results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          formattedResults.push({
            document: results.documents[0][i],
            metadata: results.metadatas?.[0]?.[i] || {},
            distance: results.distances?.[0]?.[i] || 1.0,
          });
        }
      }

      console.debug(
        `Memory query complete: ${this.name}, ` +
        `results_found: ${formattedResults.length}`
      );

      return formattedResults;
    } catch (error) {
      console.error(`Query similar situations failed (${this.name}): ${error.message}`);
      return [];
    }
  }

  /**
   * Get relevant past memories for a ticker and situation
   */
  async getRelevantMemory(ticker, situationSummary, nResults = 3) {
    if (!this.available) {
      return '';
    }

    // Query for similar situations
    const queryText = `${ticker}: ${situationSummary}`;
    const results = await this.querySimilarSituations(queryText, nResults);

    if (results.length === 0) {
      return `No relevant past memories found for ${ticker}.`;
    }

    // Format results
    let memoryText = `Relevant past memories for ${ticker}:\n\n`;
    results.forEach((result, i) => {
      const meta = result.metadata;
      const doc = result.document;
      const dist = result.distance;

      memoryText += `### Memory ${i + 1} (similarity: ${((1 - dist) * 100).toFixed(0)}%)\n`;
      memoryText += `Date: ${meta.timestamp || 'Unknown'}\n`;
      memoryText += `Ticker: ${meta.ticker || 'Unknown'}\n`;
      memoryText += `${doc.substring(0, 500)}...\n\n`;
    });

    return memoryText;
  }

  /**
   * Get statistics about this memory collection
   */
  async getStats() {
    if (!this.available) {
      return {
        available: false,
        name: this.name,
        count: 0,
      };
    }

    try {
      const count = await this.situationCollection.count();
      return {
        available: true,
        name: this.name,
        count,
      };
    } catch (error) {
      // Gracefully handle deleted collections
      if (error.message.includes('does not exist') || error.message.includes('not found')) {
        console.debug(`Collection deleted externally: ${this.name}`);
        return {
          available: false,
          name: this.name,
          count: 0,
          status: 'deleted',
        };
      }

      console.error(`Get stats failed (${this.name}): ${error.message}`);
      return {
        available: false,
        name: this.name,
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Remove memories older than specified days
   */
  async clearOldMemories(daysToKeep = 90) {
    if (!this.available) {
      return 0;
    }

    try {
      if (daysToKeep === 0) {
        // Delete entire collection
        const count = await this.situationCollection.count();
        await this.chromaClient.deleteCollection({ name: this.name });
        console.log(`Collection deleted: ${this.name}, documents_deleted: ${count}`);
        return count;
      }

      // Delete old documents
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffIso = cutoffDate.toISOString();

      const allDocs = await this.situationCollection.get();
      const idsToDelete = [];

      if (allDocs && allDocs.metadatas) {
        allDocs.ids.forEach((id, index) => {
          const metadata = allDocs.metadatas[index];
          const timestamp = metadata?.timestamp || '';
          if (timestamp && timestamp < cutoffIso) {
            idsToDelete.push(id);
          }
        });
      }

      if (idsToDelete.length > 0) {
        await this.situationCollection.delete({ ids: idsToDelete });
        console.log(
          `Old documents deleted: ${this.name}, ` +
          `count: ${idsToDelete.length}, ` +
          `days_kept: ${daysToKeep}`
        );
      }

      return idsToDelete.length;
    } catch (error) {
      console.error(`Clear old memories failed (${this.name}): ${error.message}`);
      return 0;
    }
  }
}

/**
 * Create ticker-specific memory instances to prevent cross-contamination
 */
export async function createMemoryInstances(ticker) {
  const safeTicker = sanitizeTickerForCollection(ticker);

  const memoryConfigs = [
    `${safeTicker}_bull_memory`,
    `${safeTicker}_bear_memory`,
    `${safeTicker}_trader_memory`,
    `${safeTicker}_invest_judge_memory`,
    `${safeTicker}_risk_manager_memory`,
  ];

  const instances = {};

  for (const name of memoryConfigs) {
    try {
      instances[name] = new FinancialSituationMemory(name);
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(
        `Ticker memory created: ${ticker}, ` +
        `collection_name: ${name}, ` +
        `available: ${instances[name].available}`
      );
    } catch (error) {
      console.error(
        `Ticker memory creation failed: ${ticker}, ` +
        `collection_name: ${name}, ` +
        `error: ${error.message}`
      );
      // Create a disabled instance
      instances[name] = new FinancialSituationMemory(name);
    }
  }

  return instances;
}

/**
 * Clean up memories from collections
 */
export async function cleanupAllMemories(days = 0, ticker = null) {
  const results = {};

  try {
    const client = new ChromaClient({
      path: path.resolve(config.chromaPersistDirectory),
    });

    const collections = await client.listCollections();

    // Calculate ticker prefix if provided
    let targetPrefix = null;
    if (ticker) {
      targetPrefix = sanitizeTickerForCollection(ticker);
      console.log(`Scoping memory cleanup to ticker prefix: ${targetPrefix}`);
    }

    for (const collection of collections) {
      try {
        const collectionName = collection.name;

        // Filter by ticker if requested
        if (targetPrefix && !collectionName.startsWith(targetPrefix)) {
          continue;
        }

        const coll = await client.getCollection({ name: collectionName });

        if (days === 0) {
          // Delete entire collection
          const count = await coll.count();
          await client.deleteCollection({ name: collectionName });
          results[collectionName] = count;
          console.log(`Collection deleted: ${collectionName}, documents_deleted: ${count}`);
        } else {
          // Delete old documents
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          const cutoffIso = cutoffDate.toISOString();

          const allDocs = await coll.get();
          const idsToDelete = [];

          if (allDocs && allDocs.metadatas) {
            allDocs.ids.forEach((id, index) => {
              const metadata = allDocs.metadatas[index];
              const timestamp = metadata?.timestamp || '';
              if (timestamp && timestamp < cutoffIso) {
                idsToDelete.push(id);
              }
            });
          }

          if (idsToDelete.length > 0) {
            await coll.delete({ ids: idsToDelete });
            results[collectionName] = idsToDelete.length;
            console.log(
              `Old documents deleted: ${collectionName}, ` +
              `count: ${idsToDelete.length}, ` +
              `days_kept: ${days}`
            );
          } else {
            results[collectionName] = 0;
          }
        }
      } catch (error) {
        const name = collection.name || String(collection);
        console.error(`Collection cleanup failed: ${name}, error: ${error.message}`);
        results[name] = 0;
      }
    }
  } catch (error) {
    console.error(`Cleanup all memories failed: ${error.message}`);
  }

  return results;
}

/**
 * Get statistics for all memory collections
 */
export async function getAllMemoryStats() {
  const stats = {};

  try {
    const client = new ChromaClient({
      path: path.resolve(config.chromaPersistDirectory),
    });

    const collections = await client.listCollections();

    for (const collection of collections) {
      try {
        const coll = await client.getCollection({ name: collection.name });
        const count = await coll.count();

        stats[collection.name] = {
          count,
          metadata: collection.metadata || {},
        };
      } catch (error) {
        const name = collection.name || String(collection);
        // Gracefully handle zombies
        if (error.message.includes('does not exist')) {
          continue;
        }

        console.error(`Get collection stats failed: ${name}, error: ${error.message}`);
        stats[name] = {
          count: 0,
          error: error.message,
        };
      }
    }
  } catch (error) {
    console.error(`Get all stats failed: ${error.message}`);
  }

  return stats;
}
