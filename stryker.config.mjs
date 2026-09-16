// @ts-check

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  testRunner: 'vitest',

  ignorePatterns: [
    'dist/**',
    'var/**',
    'scripts/.venv/**',
    'scripts/tests/.venv/**',
    'scripts/tests/__pycache__/**',
    'test/unit/infrastructure/pdf/pdfProvider.test.ts',
  ],
  mutate: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/presentation/uds/healthcheck.ts',
    '!src/infrastructure/pdf/pdfProvider.ts',
  ],

  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  coverageAnalysis: 'perTest',
  ignoreStatic: true,

  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },

  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'var/reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'var/reports/mutation/report.json',
  },

  tempDirName: 'var/tmp/stryker',
};

export default config;
