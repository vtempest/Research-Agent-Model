/**
 * Example usage of the TradingAgents system
 * Run with: bun run lib/trading-agents/example.ts
 */

import { TradingAgentsGraph } from './graph/trading-graph'

async function main() {
  console.log('=== TradingAgents Example ===\n')

  // Initialize the TradingAgentsGraph
  const graph = new TradingAgentsGraph(
    ['market'],  // For this example, only use market analyst
    true,  // Enable debug mode
    {
      llmProvider: 'openai',
      deepThinkLLM: 'gpt-4o-mini',  // Use mini for cost efficiency in example
      quickThinkLLM: 'gpt-4o-mini',
      temperature: 0.3,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY || ''
      }
    }
  )

  try {
    // Run analysis for AAPL
    console.log('Analyzing AAPL...\n')
    const { state, signal } = await graph.propagate('AAPL', '2024-12-11')

    console.log('\n=== Results ===')
    console.log('Signal:', signal.action)
    console.log('Confidence:', signal.confidence)
    console.log('\nMarket Report (excerpt):')
    console.log(state.marketReport.substring(0, 500) + '...')

    console.log('\nBull Arguments (excerpt):')
    console.log(state.investmentDebateState.bullHistory.substring(0, 300) + '...')

    console.log('\nBear Arguments (excerpt):')
    console.log(state.investmentDebateState.bearHistory.substring(0, 300) + '...')

    console.log('\nFinal Decision:', state.finalTradeDecision)

    // Simulate learning from outcome
    console.log('\n=== Learning from outcome ===')
    await graph.reflectAndRemember(5.2)  // Simulate 5.2% positive return
    console.log('Memory updated with trading outcome')

  } catch (error) {
    console.error('Error:', error)
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error)
}

export { main }
