# Prisma Shift

[![Documentation](https://img.shields.io/badge/docs-eftech93.github.io%2Fprisma--shift-blue)](https://eftech93.github.io/prisma-shift/)
[![Test Coverage](https://img.shields.io/badge/coverage-60%25-yellowgreen)](https://eftech93.github.io/prisma-shift/test-report.html)
[![Tests](https://img.shields.io/badge/tests-118%20passing-brightgreen)](https://eftech93.github.io/prisma-shift/test-report.html)
[![Version](https://img.shields.io/npm/v/@eftech93/prisma-shift)](https://www.npmjs.com/package/@eftech93/prisma-shift)

**[📚 Full Documentation](https://eftech93.github.io/prisma-shift/)** | **[📊 Test Report](https://eftech93.github.io/prisma-shift/test-report.html)**

TypeScript-based data migrations for Prisma. Run data transformations alongside your schema migrations with full type safety and access to the Prisma Client.

> **🚀 New in v0.0.2:** Distributed locking, batch processing, conditional migrations, migration dependencies, and more!

## Why?

Prisma's native migrations handle schema changes, but data migrations often require:
- Running JavaScript/TypeScript code
- Using the Prisma Client to query and transform data
- Complex data transformations that SQL can't handle
- Maintaining migration history and rollback capabilities

This extension provides a seamless way to write, run, and manage data migrations with TypeScript.

## Installation

```bash
npm install prisma-shift
# or
yarn add prisma-shift
# or
pnpm add prisma-shift
```

## 🔥 Prisma Generator (Recommended)

The cleanest way to integrate data migrations is using a **Prisma generator**. Add this to your `schema.prisma`:

```prisma
generator dataMigration {
  provider      = "prisma-shift-generator"
  migrationsDir = "./prisma/data-migrations"  // optional
}
```

Now data migrations will **automatically run after `prisma migrate deploy`**:

```bash
npx prisma migrate deploy  # Schema + data migrations in one command!
```

### Generator Options

| Option | Description | Default |
|--------|-------------|---------|
| `migrationsDir` | Directory for migration files | `./prisma/data-migrations` |
| `migrationsTable` | Database table for migration history | `_dataMigration` |

### Environment Variables

You can also configure via environment variables:

```bash
DATA_MIGRATIONS_DIR=./prisma/data-migrations
DATA_MIGRATIONS_TABLE=_dataMigration
```

## 🔥 Prisma CLI Integration

Alternatively, use our **Prisma CLI wrapper** that automatically runs data migrations after schema migrations:

### Replace `prisma` with `prisma-shift-migrate`

```bash
# Instead of running these 3 commands:
# npx prisma migrate deploy
# npx prisma generate
# npx prisma-shift run

# Just run this ONE command:
npx prisma-shift-migrate migrate deploy
```

### Add to your package.json

```json
{
  "scripts": {
    "migrate": "prisma-shift-migrate migrate deploy",
    "migrate:dev": "prisma-shift-migrate migrate dev"
  }
}
```

Then simply run `npm run migrate` - it handles everything!

[→ Read the full integration guide](./docs/prisma-integration.md)

## Quick Start

### 1. Initialize

```bash
npx prisma-shift init
```

This creates a `prisma/data-migrations` directory.

### 2. Create a Migration

```bash
npx prisma-shift create "add_default_preferences"
```

This generates a migration file:

```typescript
// prisma/data-migrations/20240324120000_add_default_preferences.ts
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324120000_add_default_preferences",
  name: "add_default_preferences",
  createdAt: 1711281600000,

  async up({ prisma, log }: MigrationContext) {
    await prisma.user.updateMany({
      where: { preferences: null },
      data: { preferences: { theme: "light", notifications: true } }
    });
    
    log("Added default preferences to users");
  },

  async down({ prisma, log }: MigrationContext) {
    await prisma.user.updateMany({
      data: { preferences: null }
    });
    log("Cleared user preferences");
  }
};

export default migration;
```

### 3. Run Migrations

**Option A: With Prisma CLI integration (recommended)**

Use our drop-in replacement for the Prisma CLI:

```bash
# This runs schema migrations + data migrations together!
npx prisma-shift-migrate migrate deploy
```

**Option B: Manual**

```bash
# Run data migrations only
npx prisma-shift run

# Run schema + data migrations together
npx prisma-shift run --with-schema

# Wait for lock if another instance is running
npx prisma-shift run --wait
```

## 🎓 Complete Example

See the [unified-demo](./examples/unified-demo/) for a comprehensive example with **3 schema migrations** and **12 data migrations**:

```bash
cd examples/unified-demo

# Start PostgreSQL (Docker)
docker-compose up -d

# Install and run
npm install && npm run migrate
```

**The demo includes:**
- **Docker Compose** - PostgreSQL + Adminer database UI
- **3 Schema Migrations (SQL)** - Create tables and add columns
- **12 Data Migrations (TypeScript)** - Transform data
- **JSON Data Loading** - Seed data from files
- **Computed Fields** - Generate slugs, excerpts, reading times
- **Large Dataset Processing** - Batch processing with progress
- **Enum Migration** - Transform status values
- **Multi-Table Sync** - Aggregate counts across tables
- **Conditional Migrations** - Feature flag based execution
- **Migration Dependencies** - Ensure proper ordering
- **Long-running Migrations** - With timeout support

[→ Full example documentation](./examples/unified-demo/)

## 🔀 Schema vs Data Migrations

| Type | Purpose | Tool | Example |
|------|---------|------|---------|
| **Schema Migration** | Database structure | `prisma migrate` | Add column, create table |
| **Data Migration** | Transform data | `prisma-shift` | Backfill, normalize |

### The Golden Rule

> **Always apply schema migrations BEFORE data migrations that depend on them.**

```bash
# 1. Schema migration (structure)
npx prisma migrate dev --name add_slug_column

# 2. Generate Prisma Client (CRITICAL!)
npx prisma generate

# 3. Data migration (transformation)
npx prisma-shift create backfill_slugs
npx prisma-shift run
```

## Usage as Prisma Extension

### Option 1: Using `withDataMigrations`

```typescript
import { PrismaClient } from "@prisma/client";
import { withDataMigrations } from "prisma-shift";

const basePrisma = new PrismaClient();

const prisma = withDataMigrations(basePrisma, {
  migrationsDir: "./prisma/data-migrations",
});

// Now available:
// await prisma.$dataMigrations.run()     // Run pending
// await prisma.$dataMigrations.status()  // Check status
// await prisma.$dataMigrations.rollback() // Rollback last
```

### Option 2: Using `createPrismaClientWithMigrations`

```typescript
import { createPrismaClientWithMigrations } from "prisma-shift";

const prisma = createPrismaClientWithMigrations({
  migrationsDir: "./prisma/data-migrations",
  autoRun: true, // Auto-run on startup (optional)
});
```

## CLI Commands

| Command | Description |
|---------|-------------|
| **`prisma-shift-migrate`** | **Drop-in Prisma CLI replacement** ⭐ |
| **`deploy`** | **Run schema + data migrations together** |
| `init` | Initialize data migrations |
| `create <name>` | Create a new data migration |
| `status` | Show migration status |
| `run` | Run data migrations only |
| `run --with-schema` | Run schema + data migrations |
| `run --wait` | Wait for lock if another instance is running |
| `run --dry-run` | Preview what would run |
| `validate` | Validate migration files |
| `rollback` | Rollback last migration |
| `reset` | Clear migration records |
| `squash` | Squash multiple migrations into one |
| `export` | Export migration history |

### Prisma CLI Wrapper (Recommended)

Use `prisma-shift-migrate` exactly like the regular Prisma CLI:

```bash
# Deploy schema + data migrations in one command
npx prisma-shift-migrate migrate deploy

# Development mode
npx prisma-shift-migrate migrate dev

# Generate client
npx prisma-shift-migrate generate
```

Add to your `package.json`:

```json
{
  "scripts": {
    "migrate": "prisma-shift-migrate migrate deploy",
    "migrate:dev": "prisma-shift-migrate migrate dev"
  }
}
```

### Squash Migrations

Clean up long migration histories by combining multiple migrations into one:

```bash
# Squash migrations from March 2024 into a single file
npx prisma-shift squash --from=20240301 --to=20240331 --name="march_changes"

# Dry run to preview what would happen
npx prisma-shift squash --from=20240301 --to=20240331 --name="march_changes" --dry-run

# Keep original files (don't delete them)
npx prisma-shift squash --from=20240301 --to=20240331 --name="march_changes" --keep
```

**What it does:**
- Combines all migration `up` functions in the range into a single new migration file
- Removes the original migration files (unless `--keep` is used)
- Updates the database migration records to reflect the squashed migration
- Only works on **already-executed** migrations (pending migrations in the range will block the operation)

### Unified Deploy Command (Recommended)

Run **everything** in one command:

```bash
npx prisma-shift deploy
```

This runs the complete sequence:
1. `prisma migrate deploy` - Schema migrations
2. `prisma generate` - Generate Prisma Client  
3. `prisma-shift run` - Data migrations

## Deployment Script

### Option 1: Using the unified deploy command

```bash
#!/bin/bash
set -e

# One command does it all!
npx prisma-shift deploy

npm start
```

### Option 2: Manual sequence (if you need more control)

```bash
#!/bin/bash
set -e

npx prisma migrate deploy   # Schema migrations
npx prisma generate         # Generate client
npx prisma-shift run        # Data migrations
npm start
```

### Option 3: With wait flag (for multi-instance deployments)

```bash
#!/bin/bash
set -e

# Use --wait to ensure only one instance runs migrations at a time
npx prisma-shift run --with-schema --wait

npm start
```

## Advanced Features

### Conditional Migrations

Run migrations only when conditions are met:

```typescript
const migration: DataMigration = {
  id: "20240325120000_enable_feature_x",
  name: "enable_feature_x",
  
  // Only run if condition is met
  condition: async ({ prisma }) => {
    const config = await prisma.config.findFirst();
    return config?.featureXEnabled === true;
  },
  
  async up({ prisma, log }) {
    // Migration logic
    log("Feature X is enabled, running migration...");
  },
};
```

### Migration Dependencies

Ensure migrations run in the correct order:

```typescript
const migration: DataMigration = {
  id: "20240325_add_user_stats",
  name: "add_user_stats",
  // Requires these schema migrations first
  requiresSchema: ["20240324000002_add_categories"],
  // And these data migrations
  requiresData: ["20240324010003_setup_profiles"],
  
  async up({ prisma, log }) {
    // Migration logic
  },
};
```

### Batch Processing

Process large datasets efficiently:

```typescript
async up({ prisma, log, batch }: MigrationContext) {
  await batch({
    query: () => prisma.post.findMany({ where: { processed: false } }),
    batchSize: 1000,
    process: async (posts) => {
      await prisma.post.updateMany({
        where: { id: { in: posts.map(p => p.id) } },
        data: { processed: true }
      });
    },
    onProgress: (processed, total) => {
      log(`Processed ${processed}/${total}`);
    },
  });
}
```

### Long-Running Migrations

For migrations that exceed transaction timeouts:

```typescript
const migration: DataMigration = {
  id: "20240325_backfill_large_table",
  name: "backfill_large_table",
  
  // Custom timeout (default: 0 = no timeout)
  timeout: 300000, // 5 minutes
  
  // Disable transaction for very long operations
  disableTransaction: true,
  
  async up({ prisma, log, signal }) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error("Migration was cancelled");
    }
    
    // Long-running work...
  },
};
```

### Distributed Locking

Prevent concurrent migrations in multi-instance deployments:

```typescript
const runner = new MigrationRunner(prisma, {
  migrationsDir: "./migrations",
  lock: {
    enabled: true,
    timeout: 30000,      // Lock expires after 30s
    retryAttempts: 3,    // Retry 3 times
    retryDelay: 1000,    // Wait 1s between retries
  },
});
```

Or use the `--wait` CLI flag to wait indefinitely:

```bash
npx prisma-shift run --wait
```

### Hooks

Run scripts before/after migrations:

```typescript
// prisma-shift.config.ts
export default {
  hooks: {
    beforeAll: "./scripts/backup.ts",    // Before any migration
    beforeEach: "./scripts/notify.ts",   // Before each migration
    afterEach: "./scripts/verify.ts",    // After each migration
    afterAll: "./scripts/cleanup.ts",    // After all migrations
  },
};
```

## Common Patterns

### Loading JSON Data
```typescript
import * as fs from "fs";
const data = JSON.parse(fs.readFileSync("./data/seed.json", "utf8"));
for (const item of data) {
  await prisma.user.create({ data: item });
}
```

### Idempotent Updates
```typescript
// Only process unmigrated records
const posts = await prisma.post.findMany({
  where: { slug: null },
});
```

### Batching Large Datasets
```typescript
const BATCH_SIZE = 1000;
while (hasMore) {
  const batch = await prisma.post.findMany({
    where: { processed: false },
    take: BATCH_SIZE,
  });
  // Process batch...
}
```

## Configuration

Create a `prisma-shift.config.ts` file:

```typescript
export default {
  migrationsDir: "./prisma/data-migrations",
  migrationsTable: "_dataMigration",
  schemaPath: "./prisma/schema.prisma",
  logging: {
    level: "info",      // silent, error, warn, info, debug
    progress: true,     // Show progress bars
    format: "text",     // text or json
  },
  lock: {
    enabled: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  execution: {
    timeout: 0,         // 0 = no timeout
    transaction: true,  // Run in transaction by default
  },
  typescript: {
    compiler: "tsx",    // tsx or ts-node
    transpileOnly: true,
  },
};
```

### Environment Variables

```bash
DATA_MIGRATIONS_DIR=./prisma/data-migrations
DATA_MIGRATIONS_TABLE=_dataMigration
```

## API Reference

### DataMigration Interface

```typescript
interface DataMigration {
  id: string;                    // Unique identifier
  name: string;                  // Description
  createdAt: number;             // Timestamp
  up: (context: MigrationContext) => Promise<void>;
  down?: (context: MigrationContext) => Promise<void>;
  condition?: (context: Pick<MigrationContext, "prisma" | "log">) => Promise<boolean>;
  requiresSchema?: string[];     // Schema migration dependencies
  requiresData?: string[];       // Data migration dependencies
  timeout?: number;              // Custom timeout in ms (0 = none)
  disableTransaction?: boolean;  // Run outside transaction
}
```

### MigrationContext

```typescript
interface MigrationContext {
  prisma: PrismaClient;
  log: CallableLogger;  // log("msg") or log.info("msg")
  batch: <T>(options: BatchOptions<T>) => Promise<BatchResult<T>>;
  progress: (total: number) => ProgressTracker;
  signal?: AbortSignal; // For cancellation/timeouts
}
```

### CallableLogger

The logger can be used as a function or with methods:

```typescript
// Both work:
log("Simple message");           // Defaults to info level
log.info("Info message");        // Explicit info level
log.warn("Warning message");     // Warning level
log.error("Error message");      // Error level
log.debug("Debug message");      // Debug level
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Documentation

- [Prisma Integration](./docs/prisma-integration.md) - Integrate with Prisma CLI
- [Workflow Guide](./docs/workflow.md) - Coordinating schema and data migrations
- [Unified Demo](./examples/unified-demo/) - Complete example with 3 schema + 12 data migrations

## Release Notes

### v0.0.2 (2026-03-28)

**New Features:**

- **🔒 Distributed Locking** - Prevent concurrent migrations across multiple instances with PostgreSQL advisory locks
- **⏱️ Migration Timeouts** - Set custom timeouts per migration with automatic cancellation via AbortSignal
- **🪝 Before/After Hooks** - Run scripts at various migration lifecycle stages (beforeAll, beforeEach, afterEach, afterAll)
- **📦 Batch Processing Helper** - Process large datasets efficiently with automatic pagination and progress tracking
- **🎯 Conditional Migrations** - Run migrations only when specific conditions are met (e.g., feature flags)
- **🔗 Migration Dependencies** - Declare dependencies on other migrations to ensure correct execution order
- **📊 Structured Logging** - Rich logging with multiple levels, progress indicators, and JSON format support
- **📈 Progress Tracking** - Visual progress bars for long-running operations
- **✅ Migration Validation** - Validate migration files before execution (check IDs, duplicates, TypeScript compilation)
- **📤 Export Functionality** - Export migration history to JSON, CSV, or HTML formats
- **⏳ Wait Flag (`--wait`)** - Wait for lock acquisition instead of failing immediately (great for multi-instance deployments)
- **📦 With-Schema Flag (`--with-schema`)** - Run Prisma schema migrations before data migrations in one command
- **🔧 Config File Support** - Configure via `prisma-shift.config.ts` file

**Improvements:**

- **Callable Logger API** - `log()` can be called as a function (`log("msg")`) or with methods (`log.info("msg")`)
- **Transaction Control** - Option to disable transactions for long-running migrations
- **Better Error Handling** - Clear error messages with migration context

**Example Usage:**

```bash
# Run with schema migrations
npx prisma-shift run --with-schema

# Wait for lock (for multi-instance deployments)
npx prisma-shift run --wait

# Preview changes
npx prisma-shift run --dry-run

# Validate migrations
npx prisma-shift validate

# Export history
npx prisma-shift export --format=json
```

### v0.0.1 (2024-03-24)

**Initial Release:**

- TypeScript-based data migrations
- CLI commands (init, create, run, status, rollback, reset)
- Prisma Client extension (`withDataMigrations`)
- Generator integration for auto-run after schema migrations
- Migration tracking in database
- Rollback support

## License

MIT
