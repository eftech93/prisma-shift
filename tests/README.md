# Tests

This directory contains the test suite for `prisma-shift`.

## Test Structure

```
tests/
├── setup.ts              # Test setup and global mocks
├── utils.test.ts         # Utility function tests
├── types.test.ts         # Type definition tests
├── migration-runner.test.ts  # MigrationRunner unit tests
├── extension.test.ts     # Prisma extension tests
├── cli.test.ts           # CLI command tests
└── integration.test.ts   # Integration tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI (with JUnit output)
npm run test:ci
```

## Test Coverage

The test suite includes **48 tests** covering:

| Component | Tests | Description |
|-----------|-------|-------------|
| `utils.ts` | 8 | Migration ID generation, file loading, templates |
| `types.ts` | 3 | Interface validation |
| `migration-runner.ts` | 22 | Migration execution, rollback, status, error handling |
| `extension.ts` | 5 | Prisma client extension |
| `cli.ts` | 6 | Command handling, environment variables |
| `integration` | 4 | End-to-end migration workflows |

## Writing Tests

### Unit Test Example

```typescript
import { generateMigrationId } from "../src/utils";

describe("generateMigrationId", () => {
  it("should generate valid migration ID", () => {
    const id = generateMigrationId("test migration");
    expect(id).toMatch(/^\d{14}_test_migration$/);
  });
});
```

### Integration Test Example

```typescript
describe("MigrationRunner", () => {
  it("should run migration and track execution", async () => {
    const runner = new MigrationRunner(mockPrisma, options);
    const result = await runner.runMigrations();
    
    expect(result.success).toBe(true);
    // Assert database state
  });
});
```

## Mocks

The test suite uses Jest mocks for:
- `fs` module (file system operations)
- `@prisma/client` (database operations)
- Console methods (reduces test noise)

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI integration

## CI Integration

For CI environments, tests output JUnit XML format to `reports/junit.xml`.
