/**
 * News Analyst Agent
 * Searches for and analyzes recent news about the target company
 */

import { AgentState, Message } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import * as qwk from 'qwksearch-api-client'

export class NewsAnalyst {
    private llm: UnifiedLLMClient

    constructor(llm: UnifiedLLMClient) {
        this.llm = llm
    }

    async analyze(state: AgentState): Promise<Partial<AgentState>> {
        const { companyOfInterest: ticker, tradeDate } = state

        try {
            // 1. Search for news
            const query = `${ticker} stock news analysis ${tradeDate}`
            console.log(`NewsAnalyst searching for: ${query}`)

            const searchResults = await qwk.searchWeb({
                query: {
                    q: query,
                    cat: 'news',
                    recency: 'month' // Get recent news relevant to the trade date context
                }
            })

            if (!searchResults.data?.results || searchResults.data.results.length === 0) {
                return {
                    newsReport: `No significant news found for ${ticker} around ${tradeDate}.`,
                    sender: 'NewsAnalyst'
                }
            }

            // Limit to top 5 results to avoid context overflow
            const topResults = searchResults.data.results.slice(0, 5)

            // Format results for the LLM
            const newsContext = topResults.map((r: any, i: number) => `
Article ${i + 1}:
Title: ${r.title}
Source: ${r.domain}
Snippet: ${r.snippet}
URL: ${r.url}
`).join('\n')

            const systemMessage = `You are a financial news analyst. Your job is to synthesize news headlines and snippets into a concise, relevant report for a trading strategy.
      
Focus on:
1. Significant events (earnings, mergers, regulatory changes).
2. Market sentiment (positive/negative coverage).
3. Potential impact on stock price.

Provide a summary first, then a bulleted list of key takeaways.
The current date is ${tradeDate}. The company is ${ticker}.`

            const userMessage = `Here are the latest news search results:\n${newsContext}\n\nPlease analyze these and write your report.`

            const messages: Message[] = [
                { role: 'system', content: systemMessage },
                { role: 'user', content: userMessage }
            ]

            const response = await this.llm.invoke(messages)

            return {
                newsReport: response.content,
                messages: [...state.messages, { role: 'assistant', content: response.content }],
                sender: 'NewsAnalyst'
            }

        } catch (error) {
            console.error('News Analyst error:', error)
            return {
                newsReport: `Error analyzing news for ${ticker}: ${error}`,
                sender: 'NewsAnalyst'
            }
        }
    }
}
