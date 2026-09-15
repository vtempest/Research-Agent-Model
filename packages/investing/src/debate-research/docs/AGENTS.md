# Multi-Agent Trading System - Agent Descriptions

This document provides detailed descriptions of all agents in the multi-agent trading system, their roles, responsibilities, and how they collaborate.

## System Overview

The multi-agent system operates in three distinct phases with specialized teams:

1. **Analysis Phase**: Four analysts independently examine different aspects
2. **Research Phase**: Bull and Bear researchers debate, managed by Research Manager
3. **Execution Phase**: Trader proposes, Risk Team debates sizing, Portfolio Manager decides

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                      ANALYSIS PHASE                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐│
│  │   Market     │ │  Sentiment   │ │    News      │ │  Funds  ││
│  │   Analyst    │ │   Analyst    │ │   Analyst    │ │ Analyst ││
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────┬────┘│
│         │                │                │               │     │
│         └────────────────┴────────────────┴───────────────┘     │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESEARCH PHASE                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐│
│  │     Bull     │ │     Bear     │ │    Research Manager      ││
│  │  Researcher  │ │  Researcher  │ │  (Synthesizes Debate)    ││
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────────┘│
│         │                │                     │                │
│         └────────────────┴─────────────────────┘                │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION PHASE                              │
│  ┌──────────────┐ ┌────────────────────────┐ ┌────────────────┐│
│  │    Trader    │ │     Risk Team          │ │   Portfolio    ││
│  │   (Proposes) │ │ (Debates Sizing)       │ │    Manager     ││
│  └──────┬───────┘ └────────┬───────────────┘ └────────┬───────┘│
│         │                  │                          │        │
│         └──────────────────┴──────────────────────────┘        │
│                              │                                 │
│                    FINAL DECISION: BUY/SELL/HOLD              │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## Analysis Team

### 1. Market Analyst 🔷

**Role**: Technical Analysis and Liquidity Assessment

**Responsibilities**:
- Analyze price trends and technical indicators
- Evaluate trading volume and liquidity
- Assess chart patterns and support/resistance levels
- Calculate volatility metrics (ATR, Bollinger Bands)
- Determine market momentum indicators (RSI, MACD, Moving Averages)
- Evaluate bid-ask spreads and market depth

**Key Metrics Analyzed**:
- Price action (trends, breakouts, reversals)
- Volume analysis (accumulation/distribution)
- Technical indicators (20/50/200-day MAs, RSI, MACD)
- Support and resistance levels
- Volatility measures (ATR, standard deviation)
- Liquidity metrics (average daily volume, spread)

**Output Format**:
\`\`\`
MARKET ANALYSIS
- Current Price: $XXX
- Trend: Bullish/Bearish/Neutral
- Key Levels: Support at $X, Resistance at $Y
- Volume: Above/Below average
- Liquidity: High/Medium/Low
- Technical Signal: BUY/SELL/HOLD with confidence
\`\`\`

**Data Sources**:
- Yahoo Finance (price, volume, historical data)
- EODHD (advanced technical indicators)
- Real-time quote data

---

### 2. Sentiment Analyst 💭

**Role**: Social Media Sentiment and Discovery Status

**Responsibilities**:
- Monitor social media platforms (Twitter, StockTwits, Reddit)
- Gauge retail investor sentiment
- Identify trending discussions and mentions
- Assess "undiscovered" opportunity status
- Evaluate social momentum and virality
- Track influencer opinions and positioning

**Key Metrics Analyzed**:
- Social media mention volume
- Sentiment polarity (positive/negative/neutral)
- StockTwits message counts and sentiment scores
- Reddit r/wallstreetbets activity
- Twitter/X financial influencer discussions
- Search trend momentum (Google Trends)
- Discovery score (institutional vs retail attention)

**Output Format**:
\`\`\`
SENTIMENT ANALYSIS
- Overall Sentiment: Bullish/Bearish/Mixed
- Social Volume: High/Medium/Low
- Undiscovered Status: Undiscovered/Emerging/Well-Known
- Key Themes: [List of discussion topics]
- Influencer Sentiment: Positive/Negative/Neutral
- Momentum: Increasing/Stable/Declining
\`\`\`

**Data Sources**:
- StockTwits API
- Twitter/X API (via Tavily search)
- Reddit data
- Social sentiment aggregators

---

### 3. News Analyst 📰

**Role**: Recent Events, Catalysts, and Jurisdiction Analysis

**Responsibilities**:
- Monitor recent news and press releases
- Identify upcoming catalysts (earnings, product launches, etc.)
- Assess geopolitical and regulatory risks
- Evaluate jurisdiction-specific concerns
- Track competitor news and industry trends
- Analyze management changes and corporate actions

**Key Areas Analyzed**:
- Recent news (past 7-30 days)
- Upcoming catalysts (earnings dates, product launches)
- Regulatory filings and SEC documents
- Geopolitical risks by jurisdiction
- Industry trends and competitive landscape
- Management commentary and guidance
- Analyst upgrades/downgrades

**Output Format**:
\`\`\`
NEWS ANALYSIS
- Recent Headlines: [Key stories]
- Upcoming Catalysts: [Events with dates]
- Jurisdiction Risks: [Country-specific concerns]
- Regulatory Status: Clear/Under Review/Problematic
- Industry Trends: [Sector dynamics]
- Sentiment: Positive/Negative/Neutral
\`\`\`

**Data Sources**:
- Tavily news search
- Finnhub news API
- SEC EDGAR filings
- Financial news aggregators

---

### 4. Fundamentals Analyst 📊

**Role**: Financial Scoring and Valuation

**Responsibilities**:
- Analyze financial statements (10-K, 10-Q)
- Calculate valuation metrics (P/E, P/B, P/S, EV/EBITDA)
- Assess profitability (margins, ROE, ROA)
- Evaluate growth rates (revenue, earnings)
- Score financial health (debt ratios, current ratio)
- Compare against industry peers
- Generate comprehensive DATA_BLOCK

**Key Metrics Analyzed**:
- Valuation: P/E, P/B, P/S, EV/EBITDA, PEG ratio
- Profitability: Gross margin, operating margin, net margin, ROE, ROA
- Growth: Revenue growth, earnings growth, EPS growth
- Financial Health: Debt-to-equity, current ratio, quick ratio, interest coverage
- Cash Flow: Operating cash flow, free cash flow
- Efficiency: Asset turnover, inventory turnover
- Dividend: Yield, payout ratio, dividend growth

**Output Format**:
\`\`\`
FUNDAMENTALS ANALYSIS - DATA_BLOCK

VALUATION:
- P/E Ratio: XX.X (Industry avg: YY.Y)
- P/B Ratio: X.X
- P/S Ratio: X.X
- EV/EBITDA: XX.X

PROFITABILITY:
- Gross Margin: XX%
- Operating Margin: XX%
- Net Margin: XX%
- ROE: XX%

GROWTH:
- Revenue Growth (YoY): XX%
- EPS Growth (YoY): XX%

FINANCIAL HEALTH:
- Debt/Equity: X.X
- Current Ratio: X.X
- Interest Coverage: XX.X

SCORE: X/10 (Value-to-Growth fit)
\`\`\`

**Data Sources**:
- Yahoo Finance financials
- SEC EDGAR (10-K, 10-Q filings)
- Finnhub fundamental data
- EODHD fundamental data

---

## Research Team

### 5. Bull Researcher 🐂

**Role**: Advocate for BUY Opportunities

**Responsibilities**:
- Build strongest possible case for buying
- Identify growth opportunities and catalysts
- Highlight competitive advantages and moats
- Emphasize positive trends and momentum
- Challenge bearish arguments
- Synthesize bullish signals from all analyst reports

**Debate Strategy**:
- Present thesis with supporting evidence
- Counter bear arguments with data
- Emphasize upside potential and asymmetric risk/reward
- Reference analyst findings (market technicals, positive sentiment, etc.)
- Focus on underappreciated growth drivers

**Output Format**:
\`\`\`
BULL THESIS

INVESTMENT CASE:
[Compelling narrative for why this is a BUY]

KEY CATALYSTS:
1. [Specific catalyst with impact]
2. [Specific catalyst with impact]
3. [Specific catalyst with impact]

COMPETITIVE ADVANTAGES:
- [Moat 1]
- [Moat 2]
- [Moat 3]

UPSIDE POTENTIAL:
- Target Price: $XXX (XX% upside)
- Best Case: $XXX (XX% upside)

REBUTTAL TO BEAR CONCERNS:
[Address each bear concern with counter-argument]
\`\`\`

---

### 6. Bear Researcher 🐻

**Role**: Identify Risks and Thesis Violations

**Responsibilities**:
- Build strongest possible case against buying
- Identify downside risks and red flags
- Highlight competitive threats and disruption
- Emphasize negative trends and deteriorating fundamentals
- Challenge bullish arguments
- Check for thesis violations (too expensive, too risky, too popular)

**Debate Strategy**:
- Present counter-thesis with evidence
- Challenge bull assumptions
- Emphasize downside risk and poor risk/reward
- Reference analyst findings (poor technicals, negative sentiment, etc.)
- Focus on overlooked risks

**Thesis Violation Checks**:
1. **Too Expensive**: P/E > 40, or significantly above sector average
2. **Too Risky**: High debt, negative cash flow, regulatory issues
3. **Too Popular**: Excessive social media hype, crowded trade
4. **Undiscovered Violation**: Stock already well-known and covered
5. **Liquidity Issues**: Low volume, wide spreads

**Output Format**:
\`\`\`
BEAR THESIS

RISK ASSESSMENT:
[Compelling narrative for why this is risky]

KEY RISKS:
1. [Specific risk with impact]
2. [Specific risk with impact]
3. [Specific risk with impact]

COMPETITIVE THREATS:
- [Threat 1]
- [Threat 2]
- [Threat 3]

DOWNSIDE POTENTIAL:
- Bear Target: $XXX (XX% downside)
- Worst Case: $XXX (XX% downside)

THESIS VIOLATIONS:
- Too Expensive: [Y/N + explanation]
- Too Risky: [Y/N + explanation]
- Too Popular: [Y/N + explanation]

REBUTTAL TO BULL CLAIMS:
[Address each bull claim with counter-argument]
\`\`\`

---

### 7. Research Manager 🎯

**Role**: Synthesize Debate and Enforce Thesis Compliance

**Responsibilities**:
- Review bull and bear arguments objectively
- Synthesize key insights from both sides
- Identify consensus and disagreement points
- Enforce investment thesis criteria
- Make preliminary recommendation
- Ensure debate quality and evidence-based reasoning

**Investment Thesis Criteria**:
The stock must meet these criteria to be a BUY:
1. **Value-to-Growth**: Good valuation relative to growth potential
2. **Ex-US**: Non-US company or significant international exposure
3. **Undiscovered**: Not overly popular or crowded
4. **Liquid**: Adequate trading volume and tight spreads
5. **No Critical Red Flags**: No dealbreaker risks

**Synthesis Process**:
1. Summarize bull thesis (2-3 key points)
2. Summarize bear thesis (2-3 key points)
3. Identify areas of agreement
4. Weigh evidence strength on both sides
5. Check thesis compliance
6. Make preliminary recommendation

**Output Format**:
\`\`\`
RESEARCH SYNTHESIS

BULL CASE SUMMARY:
[2-3 strongest bull arguments]

BEAR CASE SUMMARY:
[2-3 strongest bear arguments]

DEBATE ASSESSMENT:
- Points of Agreement: [List]
- Key Disagreements: [List]
- Evidence Quality: [Assessment]

THESIS COMPLIANCE CHECK:
✓/✗ Value-to-Growth fit
✓/✗ Ex-US exposure
✓/✗ Undiscovered status
✓/✗ Adequate liquidity
✓/✗ No critical red flags

PRELIMINARY RECOMMENDATION: BUY/SELL/HOLD
CONFIDENCE: High/Medium/Low

RATIONALE:
[Balanced explanation of recommendation]
\`\`\`

---

## Execution Team

### 8. Trader ⚡

**Role**: Propose Execution Parameters

**Responsibilities**:
- Propose entry price and execution strategy
- Recommend order type (market/limit/stop)
- Suggest timing considerations
- Estimate execution costs (slippage, spread)
- Propose initial risk parameters
- Consider market conditions for execution

**Execution Considerations**:
- Current market conditions (volatility, liquidity)
- Bid-ask spread and depth
- Time of day and session (pre-market, regular, after-hours)
- Recent price action and support/resistance
- Order size relative to average volume
- Urgency vs price improvement tradeoff

**Output Format**:
\`\`\`
TRADE PROPOSAL

EXECUTION PLAN:
- Entry Strategy: [Market/Limit/TWAP/VWAP]
- Target Entry Price: $XXX
- Order Type: [Specific order details]
- Execution Timing: [When to execute]

RISK PARAMETERS (Initial):
- Stop Loss: $XXX (X% below entry)
- Take Profit: $XXX (X% above entry)
- Position Size: [To be determined by Risk Team]

EXECUTION COSTS:
- Expected Slippage: X%
- Bid-Ask Spread: $X.XX
- Commission: $X.XX

MARKET CONDITIONS:
- Current Volatility: High/Medium/Low
- Liquidity Assessment: Sufficient/Limited
- Optimal Timing: [Recommendation]
\`\`\`

---

### 9. Risk Team (Risky, Safe, Neutral) ⚖️

**Role**: Debate Position Sizing

**Composition**: Three risk managers with different philosophies:

#### 9a. Risky Risk Manager 🎲
- Advocates for larger position sizes
- Emphasizes high conviction and asymmetric upside
- Willing to accept higher volatility for higher returns
- Typical recommendation: 8-15% of portfolio

#### 9b. Safe Risk Manager 🛡️
- Advocates for smaller, conservative positions
- Emphasizes capital preservation and downside protection
- Prefers diversification and lower concentration
- Typical recommendation: 2-5% of portfolio

#### 9c. Neutral Risk Manager ⚖️
- Mediates between risky and safe perspectives
- Balances risk/reward based on setup quality
- Adjusts sizing based on confidence level
- Typical recommendation: 4-8% of portfolio

**Debate Process**:
1. Each risk manager presents sizing recommendation
2. Risky makes case for larger size
3. Safe makes case for smaller size
4. Neutral proposes balanced approach
5. All three debate and justify positions
6. Consensus emerges or Portfolio Manager decides

**Risk Sizing Factors**:
- Conviction level (from research synthesis)
- Volatility and beta
- Correlation with existing portfolio
- Thesis clarity and evidence strength
- Downside risk magnitude
- Liquidity constraints
- Account size and diversification

**Output Format**:
\`\`\`
RISK TEAM DEBATE

RISKY MANAGER:
- Recommended Size: XX% of portfolio
- Rationale: [Aggressive case]
- Max Loss Tolerance: $XXX (X% of portfolio)

SAFE MANAGER:
- Recommended Size: X% of portfolio
- Rationale: [Conservative case]
- Max Loss Tolerance: $XX (X% of portfolio)

NEUTRAL MANAGER:
- Recommended Size: X% of portfolio
- Rationale: [Balanced case]
- Max Loss Tolerance: $XXX (X% of portfolio)

CONSENSUS RECOMMENDATION: X-X% of portfolio
POSITION SIZE: X shares at $XXX = $XX,XXX total
MAX LOSS: $X,XXX (X% of portfolio)
\`\`\`

---

### 10. Portfolio Manager 👔

**Role**: Final Authority on All Trading Decisions

**Responsibilities**:
- Review all analyses, debates, and recommendations
- Make final BUY/SELL/HOLD decision
- Approve position sizing and risk parameters
- Ensure portfolio-level risk management
- Authorize trade execution
- Document decision rationale

**Decision-Making Framework**:
1. Review analysis phase findings
2. Evaluate research debate synthesis
3. Assess trader's execution proposal
4. Consider risk team's sizing debate
5. Apply portfolio-level constraints
6. Make final decision with clear rationale

**Portfolio-Level Considerations**:
- Current portfolio composition
- Sector and geography diversification
- Total risk exposure and concentration limits
- Cash reserves and buying power
- Correlation with existing positions
- Overall portfolio strategy alignment

**Final Decision Criteria**:
- Does this meet investment thesis requirements?
- Is the risk/reward compelling?
- Does sizing match conviction level?
- Are there any dealbreaker red flags?
- How does this fit the portfolio?

**Output Format**:
\`\`\`
FINAL TRADE DECISION

DECISION: BUY / SELL / HOLD

POSITION DETAILS:
- Ticker: $XXX
- Entry Price: $XXX
- Position Size: XXX shares ($XX,XXX total)
- Portfolio Allocation: X.X%
- Stop Loss: $XXX (X% risk)
- Take Profit: $XXX (X% target)

RATIONALE:
[Clear, comprehensive explanation of why this decision was made,
referencing key points from analysts, researchers, trader, and
risk team. Address both bull and bear cases.]

KEY FACTORS:
1. [Most important consideration]
2. [Second most important consideration]
3. [Third most important consideration]

RISK ASSESSMENT:
- Primary Risk: [Biggest concern]
- Risk Mitigation: [How it's addressed]
- Max Acceptable Loss: $XXX (X% of portfolio)

CONVICTION LEVEL: High / Medium / Low

EXECUTION AUTHORIZATION:
[Approved for immediate execution / Execute on X conditions / Do not execute]

---

Portfolio Manager: [Name]
Date: [Timestamp]
\`\`\`

---

## Agent Interaction Flow

### Full Analysis Workflow

\`\`\`
1. USER INPUT
   └─> Ticker symbol (e.g., AAPL)

2. PARALLEL ANALYSIS (All analysts work simultaneously)
   ├─> Market Analyst → Technical report
   ├─> Sentiment Analyst → Sentiment report
   ├─> News Analyst → News report
   └─> Fundamentals Analyst → DATA_BLOCK

3. FINANCIAL VALIDATION
   └─> Check for red flags → Route to appropriate path

4. RESEARCH DEBATE
   ├─> Bull Researcher → Bull thesis
   ├─> Bear Researcher → Bear thesis
   └─> Research Manager → Synthesis and preliminary recommendation

5. OPTIONAL CROSS-VALIDATION
   └─> Consultant (OpenAI) → Independent second opinion

6. TRADE PROPOSAL
   └─> Trader → Execution plan and initial risk parameters

7. RISK SIZING DEBATE
   ├─> Risky Risk Manager → Aggressive sizing
   ├─> Safe Risk Manager → Conservative sizing
   ├─> Neutral Risk Manager → Balanced sizing
   └─> Consensus or debate

8. FINAL DECISION
   └─> Portfolio Manager → FINAL DECISION: BUY/SELL/HOLD

9. OUTPUT
   └─> Complete analysis report with decision and rationale
\`\`\`

### Communication Protocol

**Between Analysts**:
- No direct communication
- Work independently to avoid bias
- Results aggregated by Research Manager

**Research Team**:
- Bull and Bear engage in structured debate
- Research Manager moderates and synthesizes
- Must provide evidence-based arguments

**Execution Team**:
- Trader proposes, doesn't decide
- Risk Team debates sizing only (not decision itself)
- Portfolio Manager has final authority

**Information Flow**:
- Analysts → Research Team (one-way)
- Research Team → Execution Team (one-way)
- Portfolio Manager sees all (full visibility)

---

## Prompt Engineering

Each agent has a carefully crafted system prompt that defines:

1. **Role and Expertise**: What the agent specializes in
2. **Responsibilities**: Specific tasks to perform
3. **Output Format**: Structured format for responses
4. **Constraints**: What to avoid or emphasize
5. **Tools Available**: Which data sources they can access
6. **Collaboration Protocol**: How to interact with other agents

### Example: Market Analyst Prompt Structure

\`\`\`
You are the Market Analyst in a multi-agent trading system.

ROLE:
You specialize in technical analysis and liquidity assessment.

RESPONSIBILITIES:
- Analyze price trends using moving averages, RSI, MACD
- Evaluate trading volume and market depth
- [... detailed list ...]

OUTPUT FORMAT:
Provide a structured analysis with these sections:
1. Current Price & Trend
2. Technical Indicators
3. Volume Analysis
4. Support & Resistance Levels
5. Liquidity Assessment
6. Signal: BUY/SELL/HOLD with confidence level

CONSTRAINTS:
- Use only factual, data-driven analysis
- Do not make final trading decisions
- Focus on technical aspects only (no fundamentals)

TOOLS:
You have access to:
- Yahoo Finance API for quotes and historical data
- Technical indicator calculations
- Volume and liquidity metrics
\`\`\`

---

## Performance Optimization

### LLM Selection

**Quick Mode (Gemini 2.0 Flash)**:
- Faster analysis (5-15 seconds total)
- Lower cost (~$0.002-0.005 per analysis)
- Suitable for initial screening
- Less detailed reasoning

**Deep Mode (Gemini 3.0 Pro)**:
- Thorough analysis (30-60 seconds total)
- Higher cost (~$0.01-0.02 per analysis)
- Better for final decisions
- Extended thinking capabilities

### Parallel Execution

Analysts run in parallel to minimize latency:
\`\`\`
Sequential: 4 agents × 10s = 40s
Parallel: max(10s, 10s, 10s, 10s) = 10s
\`\`\`

### Caching and Memory

- Vector memory (ChromaDB) stores past analyses
- Reduces redundant LLM calls for recently analyzed tickers
- Embedding-based retrieval of similar situations

---

## Quality Assurance

### Output Validation

Each agent output is validated for:
1. Format compliance
2. Required fields present
3. Data consistency
4. Logical coherence

### Debate Quality

Research Manager ensures:
1. Both bull and bear provide evidence
2. Arguments address each other
3. No circular reasoning
4. Facts are verifiable

### Decision Traceability

Every decision includes:
1. Complete audit trail
2. All agent outputs preserved
3. Decision rationale documented
4. Timestamp and version info

---

## Future Enhancements

### Planned Agent Additions

1. **Macro Analyst**: Global economic and sector trends
2. **Options Analyst**: Implied volatility and options flow
3. **Insider Activity Analyst**: Executive trades and ownership
4. **Short Interest Analyst**: Borrow rates and squeeze potential

### Planned Features

1. **Multi-ticker comparison**: Compare multiple stocks simultaneously
2. **Portfolio rebalancing**: Suggest adjustments to existing portfolio
3. **Event-driven triggers**: Auto-analyze on earnings, FDA approvals, etc.
4. **Backtesting mode**: Test agent decisions on historical data

---

**For implementation status, see [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)**
**For integration details, see [INTEGRATION.md](INTEGRATION.md)**
