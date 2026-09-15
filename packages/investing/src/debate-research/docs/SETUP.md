# Setup Guide - Multi-Agent Trading System (JavaScript)

This guide walks you through setting up the JavaScript version of the Multi-Agent Trading System.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **API Keys**: Google Gemini, Finnhub, Tavily (required)

## Quick Start

### 1. Install Dependencies

\`\`\`bash
cd lib/debate-agents/debate-agents-js
npm install
\`\`\`

### 2. Configure Environment

Copy the example environment file:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` and add your API keys:

\`\`\`bash
# Minimum required configuration
GOOGLE_API_KEY=your_actual_key_here
FINNHUB_API_KEY=your_actual_key_here
TAVILY_API_KEY=your_actual_key_here
\`\`\`

### 3. Run Health Check

Verify your setup:

\`\`\`bash
npm run health-check
\`\`\`

Expected output:
\`\`\`
✓ Python version: 18.x
✓ Environment variables: All required keys present
✓ LLM connectivity: OK
✓ Overall health check: PASSED
\`\`\`

### 4. Run Your First Analysis

\`\`\`javascript
import { initialize } from './index.js';

await initialize();

// Your analysis code here
\`\`\`

## Detailed Setup

### API Keys

#### Required APIs

1. **Google Gemini API**
   - Get from: https://ai.google.dev/
   - Free tier: 15 requests/minute
   - Paid tier: 360+ requests/minute
   - Set `GEMINI_RPM_LIMIT` based on your tier

2. **Finnhub API**
   - Get from: https://finnhub.io/
   - Free tier: 60 calls/minute
   - Used for: Market data, financial metrics

3. **Tavily API**
   - Get from: https://tavily.com/
   - Free tier: 1000 requests/month
   - Used for: News search, web scraping

#### Optional APIs

4. **EODHD API** (Recommended for ex-US stocks)
   - Get from: https://eodhistoricaldata.com/
   - Provides high-quality international data
   - Better coverage for Asian/European stocks

5. **OpenAI API** (For consultant cross-validation)
   - Get from: https://platform.openai.com/
   - Used for: Independent analysis review
   - Model: GPT-4o (recommended)

### Configuration Options

#### Model Selection

\`\`\`bash
# Use Gemini 3 Pro for deep thinking (expensive, thorough)
DEEP_MODEL=gemini-3-pro-preview

# Use Gemini 2.0 Flash for quick analysis (fast, cheap)
QUICK_MODEL=gemini-2.0-flash
\`\`\`

#### Rate Limiting

\`\`\`bash
# Free tier users (default)
GEMINI_RPM_LIMIT=15

# Paid tier users
GEMINI_RPM_LIMIT=360
\`\`\`

The system will automatically throttle requests to stay within your limit.

#### Memory System

\`\`\`bash
# Enable persistent memory (recommended)
ENABLE_MEMORY=true

# Disable memory (for testing or privacy)
ENABLE_MEMORY=false
\`\`\`

Memory is stored in ChromaDB and persists between runs. Each ticker gets its own isolated memory.

#### Consultant Mode

\`\`\`bash
# Enable OpenAI cross-validation
ENABLE_CONSULTANT=true
OPENAI_API_KEY=your_key_here

# Disable consultant (to save costs)
ENABLE_CONSULTANT=false
\`\`\`

The consultant provides independent analysis using a different LLM vendor (OpenAI vs Google).

### Directory Structure

\`\`\`bash
debate-agents-js/
├── .env                    # Your API keys (create from .env.example)
├── .env.example            # Template
├── package.json            # Dependencies
├── README.md               # Documentation
├── SETUP.md                # This file
├── index.js                # Main exports
├── config.js               # Configuration
├── llms.js                 # LLM setup
├── prompts.js              # Agent prompts
├── utils.js                # Utilities
├── results/                # Analysis outputs (auto-created)
├── data_cache/             # Cached API responses (auto-created)
└── chroma_db/              # Vector memory storage (auto-created)
\`\`\`

Directories (`results/`, `data_cache/`, `chroma_db/`) are created automatically on first run.

## Compatibility with Python Version

The JavaScript version is designed to work alongside the Python version:

### Shared Resources

1. **Prompts Directory**: `../prompts/`
   - Both versions load custom prompts from here
   - JSON format ensures compatibility

2. **Results Directory**: `./results/`
   - JSON output format matches Python
   - Can be read by either system

3. **ChromaDB**: `./chroma_db/`
   - Memories created by Python are readable by JavaScript
   - Same embedding model: `text-embedding-004`

### Using Python Prompts in JavaScript

\`\`\`bash
# Export Python prompts to JSON
cd ../
python -c "from prompts import export_prompts; export_prompts()"

# JavaScript will auto-load from ../prompts/*.json
\`\`\`

### Data Consistency

Both systems use:
- Same API sources (yfinance, Finnhub, Tavily)
- Same embedding model for memory
- Same prompt templates (when synced)
- Same output JSON schema

## Troubleshooting

### "Missing required environment variable"

**Problem**: `.env` file not found or incomplete

**Solution**:
\`\`\`bash
cp .env.example .env
# Edit .env and add your API keys
\`\`\`

### "Rate limit exceeded"

**Problem**: Too many requests to Gemini API

**Solutions**:
1. Lower `GEMINI_RPM_LIMIT` in `.env`
2. Upgrade to paid Gemini tier
3. Add delays between analyses

### "Module not found"

**Problem**: Dependencies not installed

**Solution**:
\`\`\`bash
npm install
\`\`\`

### "ChromaDB connection failed"

**Problem**: ChromaDB server not running or directory permissions

**Solution**:
\`\`\`bash
# Check directory permissions
chmod -R 755 ./chroma_db

# If using external ChromaDB server:
# Update CHROMA_PERSIST_DIR in .env
\`\`\`

### "LLM timeout"

**Problem**: API call took too long

**Solution**:
\`\`\`bash
# Increase timeout in .env
API_TIMEOUT=600  # 10 minutes

# Or reduce context size
\`\`\`

## Performance Tuning

### For Speed

\`\`\`bash
# Use quick mode
QUICK_MODEL=gemini-2.0-flash
MAX_DEBATE_ROUNDS=1
MAX_RISK_DISCUSS_ROUNDS=1
\`\`\`

### For Accuracy

\`\`\`bash
# Use deep thinking
DEEP_MODEL=gemini-3-pro-preview
MAX_DEBATE_ROUNDS=3
MAX_RISK_DISCUSS_ROUNDS=2
ENABLE_CONSULTANT=true
\`\`\`

### For Cost Savings

\`\`\`bash
# Minimize LLM calls
MAX_DEBATE_ROUNDS=1
MAX_RISK_DISCUSS_ROUNDS=1
ENABLE_CONSULTANT=false
ENABLE_MEMORY=false  # Saves embedding API calls
\`\`\`

## Development Setup

### Install Dev Dependencies

\`\`\`bash
npm install --save-dev
\`\`\`

### Run in Watch Mode

\`\`\`bash
npm run dev
\`\`\`

### Linting and Formatting

\`\`\`bash
npm run lint
npm run format
\`\`\`

### Testing

\`\`\`bash
npm test
\`\`\`

## Production Deployment

### Environment Variables

Set these in your production environment (not in `.env` file):

\`\`\`bash
export NODE_ENV=production
export GOOGLE_API_KEY=your_production_key
export FINNHUB_API_KEY=your_production_key
export TAVILY_API_KEY=your_production_key
export GEMINI_RPM_LIMIT=360  # Use paid tier in production
\`\`\`

### Logging

Configure logging level:

\`\`\`bash
export LOG_LEVEL=WARN  # Reduce noise in production
export QUIET_MODE=true  # Minimal output
\`\`\`

### Health Monitoring

Run periodic health checks:

\`\`\`bash
*/5 * * * * cd /path/to/debate-agents-js && npm run health-check
\`\`\`

## Next Steps

1. **Read the README**: [README.md](README.md) for architecture overview
2. **Review Prompts**: Check `../prompts/` for agent instructions
3. **Run Examples**: See usage examples in README
4. **Join Community**: Report issues, contribute improvements

## Support

- **Issues**: https://github.com/your-repo/issues
- **Python Version**: `../` (source of truth)
- **Documentation**: This directory

---

**Ready to trade? Happy analyzing! 📈🤖**
