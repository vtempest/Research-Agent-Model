#!/usr/bin/env node
/**
 * System health check for Multi-Agent Trading System
 * JavaScript port of Python health_check.py
 *
 * Validates configuration, dependencies, and API connectivity
 */

import { config, validateEnvironmentVariables } from './config.js';
import { createQuickThinkingLLM } from './llms.js';
import { HumanMessage } from '@langchain/core/messages';
import process from 'process';

const PASS = '✓';
const FAIL = '✗';

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  console.log('\n=== Node.js Version ===');
  console.log(`${PASS} Node.js version: ${nodeVersion}`);

  if (majorVersion < 18) {
    console.log(`${FAIL} WARNING: Node.js 18+ recommended (current: ${nodeVersion})`);
    return false;
  }

  return true;
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log('\n=== Environment Variables ===');

  const required = [
    'GOOGLE_API_KEY',
    'FINNHUB_API_KEY',
    'TAVILY_API_KEY',
  ];

  const optional = [
    'EODHD_API_KEY',
    'OPENAI_API_KEY',
    'LANGSMITH_API_KEY',
  ];

  let allRequired = true;

  for (const varName of required) {
    if (process.env[varName]) {
      console.log(`${PASS} ${varName}: Present`);
    } else {
      console.log(`${FAIL} ${varName}: MISSING (required)`);
      allRequired = false;
    }
  }

  for (const varName of optional) {
    if (process.env[varName]) {
      console.log(`${PASS} ${varName}: Present (optional)`);
    } else {
      console.log(`  ${varName}: Not set (optional)`);
    }
  }

  if (!allRequired) {
    console.log(`\n${FAIL} Missing required environment variables`);
    console.log('Please check your .env file');
    return false;
  }

  console.log(`\n${PASS} All required environment variables present`);
  return true;
}

/**
 * Check LLM connectivity
 */
async function checkLLMConnectivity() {
  console.log('\n=== LLM Connectivity ===');

  try {
    const llm = createQuickThinkingLLM({ temperature: 0 });
    const testMessage = new HumanMessage({
      content: 'Say "OK" if you can read this.',
    });

    console.log('Testing Gemini API connection...');
    const response = await llm.invoke([testMessage]);

    if (response && response.content) {
      console.log(`${PASS} LLM connectivity: OK`);
      console.log(`  Model: ${config.quickThinkLlm}`);
      console.log(`  Response: ${response.content.substring(0, 100)}`);
      return true;
    }

    console.log(`${FAIL} LLM connectivity: Empty response`);
    return false;
  } catch (error) {
    console.log(`${FAIL} LLM connectivity: FAILED`);
    console.log(`  Error: ${error.message}`);

    if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.log('  Hint: Rate limit exceeded. Wait a moment and try again.');
    } else if (error.message.includes('401') || error.message.includes('API key')) {
      console.log('  Hint: Check your GOOGLE_API_KEY in .env file');
    }

    return false;
  }
}

/**
 * Check configuration
 */
function checkConfiguration() {
  console.log('\n=== Configuration ===');

  console.log(`${PASS} Deep model: ${config.deepThinkLlm}`);
  console.log(`${PASS} Quick model: ${config.quickThinkLlm}`);
  console.log(`${PASS} RPM limit: ${config.geminiRpmLimit}`);
  console.log(`${PASS} Memory enabled: ${config.enableMemory}`);
  console.log(`${PASS} Online tools: ${config.onlineTools}`);

  return true;
}

/**
 * Check directory structure
 */
function checkDirectories() {
  console.log('\n=== Directories ===');

  const directories = [
    config.resultsDir,
    config.dataCacheDir,
    config.chromaPersistDirectory,
  ];

  let allExist = true;

  for (const dir of directories) {
    const exists = require('fs').existsSync(dir);
    if (exists) {
      console.log(`${PASS} ${dir}: Exists`);
    } else {
      console.log(`${FAIL} ${dir}: Missing (will be auto-created)`);
      allExist = false;
    }
  }

  return allExist;
}

/**
 * Check dependencies
 */
function checkDependencies() {
  console.log('\n=== Dependencies ===');

  const dependencies = [
    '@langchain/google-genai',
    '@langchain/core',
    '@langchain/langgraph',
    'chromadb',
    'dotenv',
  ];

  let allInstalled = true;

  for (const dep of dependencies) {
    try {
      require(dep);
      console.log(`${PASS} ${dep}: Installed`);
    } catch (error) {
      console.log(`${FAIL} ${dep}: NOT INSTALLED`);
      allInstalled = false;
    }
  }

  if (!allInstalled) {
    console.log(`\n${FAIL} Missing dependencies. Run: npm install`);
    return false;
  }

  console.log(`\n${PASS} All dependencies installed`);
  return true;
}

/**
 * Run all health checks
 */
async function runHealthCheck() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Multi-Agent Trading System - Health Check (JavaScript)      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const results = {
    nodeVersion: checkNodeVersion(),
    dependencies: checkDependencies(),
    envVars: checkEnvironmentVariables(),
    config: checkConfiguration(),
    directories: checkDirectories(),
  };

  // LLM connectivity check (only if env vars are present)
  if (results.envVars) {
    results.llmConnectivity = await checkLLMConnectivity();
  } else {
    console.log('\n=== LLM Connectivity ===');
    console.log(`${FAIL} Skipped (missing environment variables)`);
    results.llmConnectivity = false;
  }

  // Overall result
  console.log('\n' + '='.repeat(70));
  console.log('HEALTH CHECK SUMMARY');
  console.log('='.repeat(70));

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log(`\n${PASS} Overall health check: PASSED`);
    console.log('\nSystem is ready to run analyses.');
    process.exit(0);
  } else {
    console.log(`\n${FAIL} Overall health check: FAILED`);
    console.log('\nPlease fix the issues above before running analyses.');
    console.log('\nFailed checks:');

    for (const [check, passed] of Object.entries(results)) {
      if (!passed) {
        console.log(`  ${FAIL} ${check}`);
      }
    }

    console.log('\nTroubleshooting:');
    console.log('  1. Run: npm install');
    console.log('  2. Copy .env.example to .env and add your API keys');
    console.log('  3. Check API key validity at https://ai.google.dev/');
    console.log('  4. See SETUP.md for detailed instructions');

    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck().catch(error => {
    console.error('\nHealth check failed with error:', error);
    process.exit(1);
  });
}

export { runHealthCheck };
