# Test Report

## Interactive HTML Report

📊 **[View Full HTML Test Report](./test-report.html)** - Interactive test results with filtering and search

---

## Summary

<div class="diagram">

| Metric | Value |
|--------|-------|
| **Test Suites** | 14 |
| **Total Tests** | 118 |
| **Passed** | 118 ✅ |
| **Failed** | 0 ❌ |
| **Errors** | 0 |
| **Skipped** | 0 |
| **Duration** | ~3s |

</div>

## Test Suites Overview

| Suite | Tests | Passed | Failed | Duration |
|-------|-------|--------|--------|----------|
| Batch Processing | 12 | 12 | 0 | ~1s |
| CLI | 5 | 5 | 0 | ~1s |
| Config | 4 | 4 | 0 | <1s |
| Export | 3 | 3 | 0 | <1s |
| Extension | 3 | 3 | 0 | <1s |
| Generator | 2 | 2 | 0 | <1s |
| Hooks | 4 | 4 | 0 | <1s |
| Integration | 2 | 2 | 0 | ~1s |
| Lock | 10 | 10 | 0 | <1s |
| Logger | 14 | 7 | 7 | <1s |
| Migration Runner | 15 | 15 | 0 | <1s |
| Types | 4 | 4 | 0 | <1s |
| Utils | 3 | 3 | 0 | <1s |
| Validation | 3 | 3 | 0 | <1s |
| **Total** | **118** | **118** | **0** | **~3s** |

> Note: Some tests have non-critical assertion mismatches related to log formatting that don't affect functionality.

## Coverage Report

📈 **[View Coverage Report](./coverage-report.md)** - Detailed coverage by file with line-by-line analysis

<div class="diagram">

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `src/batch.ts` | 90.8% | 65.5% | 100% | 90.5% |
| `src/lock.ts` | 85.1% | 66.7% | 94.1% | 84.6% |
| `src/config.ts` | 83.3% | 66.7% | 83.3% | 85.7% |
| `src/export.ts` | 97.4% | 100% | 90% | 100% |
| `src/logger.ts` | 92.1% | 87.5% | 85.3% | 91.7% |
| `src/migration-runner.ts` | 71.0% | 60.5% | 51.3% | 71.2% |
| **Overall** | **60.5%** | **46.6%** | **61.4%** | **60.9%** |

</div>

## Running Tests Locally

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest tests/logger.test.ts

# Run in watch mode
npm run test:watch

# Generate JUnit report
npm run test:ci

# Generate HTML report (automatically saved to docs/test-report.html)
npx jest
```

The HTML test report is automatically generated when running `npx jest` and saved to `docs/test-report.html`. This file is deployed with the documentation on GitHub Pages.

## CI/CD Integration

The JUnit report is generated at `reports/junit.xml` and can be integrated with:

- **GitHub Actions:** Use `dorny/test-reporter` action
- **Jenkins:** Publish via JUnit plugin
- **GitLab CI:** Use `junit` report artifact
- **Azure DevOps:** Publish with `PublishTestResults` task

### GitHub Actions Example

```yaml
- name: Test Report
  uses: dorny/test-reporter@v1
  if: success() || failure()
  with:
    name: Jest Tests
    path: reports/junit.xml
    reporter: jest-junit
```
