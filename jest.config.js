/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts',
  ],
  coverageDirectory: 'docs/coverage',
  coverageReporters: ['text', 'html', 'json-summary'],
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Prisma Shift Test Report',
      outputPath: './docs/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true,
    }]
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};
