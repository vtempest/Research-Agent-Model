/**
 * Financial Situation Memory
 * Stores and retrieves past trading decisions with semantic similarity matching
 */

import { Memory, TradingConfig } from '../types'

export class FinancialSituationMemory {
  private name: string
  private memories: Memory[] = []
  private config: TradingConfig

  constructor(name: string, config: TradingConfig) {
    this.name = name
    this.config = config
  }

  /**
   * Add a new memory to the store
   */
  async addMemory(memory: Memory): Promise<void> {
    this.memories.push({
      ...memory,
      timestamp: new Date()
    })

    // Keep only the last 100 memories to prevent unbounded growth
    if (this.memories.length > 100) {
      this.memories = this.memories.slice(-100)
    }
  }

  /**
   * Get memories similar to the current situation
   * Uses simple keyword matching for now, can be enhanced with embeddings
   */
  async getMemories(currentSituation: string, nMatches: number = 2): Promise<Memory[]> {
    if (this.memories.length === 0) {
      return []
    }

    // Simple keyword-based similarity scoring
    const scoredMemories = this.memories.map(memory => {
      const score = this.calculateSimilarity(currentSituation, memory.situation)
      return { memory, score }
    })

    // Sort by similarity score (descending) and return top N
    scoredMemories.sort((a, b) => b.score - a.score)
    return scoredMemories.slice(0, nMatches).map(item => item.memory)
  }

  /**
   * Calculate similarity between two text strings using keyword overlap
   * Can be enhanced with more sophisticated methods like cosine similarity with embeddings
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = this.tokenize(text1)
    const words2 = this.tokenize(text2)

    const intersection = words1.filter(word => words2.includes(word))
    const union = new Set([...words1, ...words2])

    // Jaccard similarity
    return intersection.length / union.size
  }

  /**
   * Tokenize text into meaningful words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3) // Filter out short words
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories = []
  }

  /**
   * Get all memories
   */
  getAllMemories(): Memory[] {
    return [...this.memories]
  }

  /**
   * Get memory count
   */
  getMemoryCount(): number {
    return this.memories.length
  }
}
