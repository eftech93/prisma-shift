# Test Report

> Generated: 2026-04-18T04:56:04.265Z

📊 **[View Full HTML Test Report](./test-report.html)** - Interactive test results with filtering and search

---

## Summary

<div class="diagram">

| Metric | Value |
|--------|-------|
| **Test Suites** | 16 passed, 0 failed, 0 pending (total: 16) |
| **Total Tests** | 138 |
| **Passed** | 138 ✅ |
| **Failed** | 0 ❌ |
| **Pending** | 0 ⏸️ |
| **Suite Success Rate** | 100.0% |
| **Test Success Rate** | 100.0% |

</div>

## Progress Bar

<div style="margin: 20px 0;">
  <div style="background: #e0e0e0; border-radius: 4px; height: 24px; overflow: hidden; font-size: 12px; line-height: 24px; text-align: center; color: white;">
    <div style="background: #4caf50; height: 100%; width: 100.0%; float: left;">138 passed</div>
    
    
  </div>
</div>

## Coverage Report

📈 **[View Coverage Report](./coverage-report.md)** - Detailed coverage by file with line-by-line analysis

<div class="diagram">

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `src/batch.ts` | 90.8% | 65.51% | 100% | 90.47% |
| `src/config.ts` | 83.33% | 66.66% | 83.33% | 85.71% |
| `src/export.ts` | 97.43% | 100% | 90% | 100% |
| `src/extension.ts` | 32% | 0% | 22.22% | 32% |
| `src/generator.ts` | 11.11% | 0% | 0% | 11.11% |
| `src/hooks.ts` | 55.88% | 18.75% | 54.54% | 57.57% |
| `src/index.ts` | 0% | 100% | 0% | 0% |
| `src/lock.ts` | 85.07% | 66.66% | 94.11% | 84.61% |
| `src/logger.ts` | 92.06% | 87.5% | 85.29% | 91.66% |
| `src/migration-runner.ts` | 74.87% | 62.88% | 60.41% | 74.48% |
| `src/squash.ts` | 80.5% | 72.89% | 100% | 82.55% |
| `src/utils.ts` | 16.9% | 0% | 16.66% | 17.39% |
| `src/validation.ts` | 20.65% | 9.83% | 14.28% | 21.59% |
| **Overall** | **65.05%** | **53.47%** | **65.95%** | **65.43%** |

</div>

## Test Suites

### ✅ Passed (16)

<details>
<summary>Click to expand passed test suites</summary>

#### ✅ tests/integration.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 9 passed, 0 failed, 0 pending  

#### ✅ tests/batch.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 16 passed, 0 failed, 0 pending  

#### ✅ tests/lock.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 14 passed, 0 failed, 0 pending  

#### ✅ tests/squash.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 16 passed, 0 failed, 0 pending  

#### ✅ tests/export.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 11 passed, 0 failed, 0 pending  

#### ✅ tests/hooks.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 7 passed, 0 failed, 0 pending  

#### ✅ tests/generator.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 2 passed, 0 failed, 0 pending  

#### ✅ tests/config.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 8 passed, 0 failed, 0 pending  

#### ✅ tests/cli.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 10 passed, 0 failed, 0 pending  

#### ✅ tests/migration-runner.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 12 passed, 0 failed, 0 pending  

#### ✅ tests/validation.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 2 passed, 0 failed, 0 pending  

#### ✅ tests/migration-runner-squash.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 4 passed, 0 failed, 0 pending  

#### ✅ tests/extension.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 4 passed, 0 failed, 0 pending  

#### ✅ tests/logger.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 14 passed, 0 failed, 0 pending  

#### ✅ tests/utils.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 5 passed, 0 failed, 0 pending  

#### ✅ tests/types.test.ts

- **Status**: passed  
- **Duration**: N/A  
- **Tests**: 4 passed, 0 failed, 0 pending  

</details>

---

## Running Tests Locally

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Generate test report and publish
npm run publish:lib
```
