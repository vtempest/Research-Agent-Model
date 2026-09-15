import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Suites that call the real search engines over the network. Whether they pass
 * is decided by third-party availability and by whether the engine feels like
 * rate-limiting the runner's IP that minute, so they are opt-in
 * (`bun run test:live`) instead of gating every push. `test/sources-unit.test.ts`
 * covers the same engines against mocked responses and does gate CI.
 */
const LIVE_NETWORK_SUITES = [
    'test/api.test.ts',
    'test/autocomplete-ai.test.ts',
    'test/engine-health-suite.test.ts',
    'test/search.test.ts',
    'test/sources.test.ts'
];

const includeLive = process.env.RUN_LIVE_TESTS === '1';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        exclude: [
            ...configDefaults.exclude,
            ...(includeLive ? [] : LIVE_NETWORK_SUITES)
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/**',
                'dist/**',
                'examples/**',
                '**/*.test.ts',
                '**/__tests__/**'
            ]
        },
        testTimeout: 30000, // 30 seconds for network requests
        hookTimeout: 30000
    }
});
