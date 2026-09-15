module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The suites live in `test/`; the previous `__tests__` roots did not exist,
  // so `jest` failed validation and none of them ran.
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }]
  },
  // `https-proxy-agent` pulls in `agent-base` and `proxy-agent-negotiate`,
  // all three ESM-only, while ts-jest compiles the suites to CommonJS —
  // requiring them throws "Must use import to load ES Module" on any Node
  // without require(esm) (i.e. below v24.9). Transforming node_modules too
  // covers that chain without pinning a package list that goes stale the next
  // time the chain moves; only modules the suites actually load get compiled,
  // so the whole run still finishes in a few seconds.
  transformIgnorePatterns: []
};
