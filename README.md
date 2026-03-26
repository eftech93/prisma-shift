# Prisma Shift

TypeScript-based data migrations for Prisma. Run data transformations alongside your schema migrations with full type safety and access to the Prisma Client.

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
npx prisma-shift run
```

## 🎓 Complete Example

See the [unified-demo](./examples/unified-demo/) for a comprehensive example with **3 schema migrations** and **8 data migrations**:

```bash
cd examples/unified-demo

# Start PostgreSQL (Docker)
docker-compose up -d

# Install and run
npm install && ./deploy.sh
```

**The demo includes:**
- **Docker Compose** - PostgreSQL + Adminer database UI
- **3 Schema Migrations (SQL)** - Create tables and add columns
- **8 Data Migrations (TypeScript)** - Transform data
- **JSON Data Loading** - Seed data from files
- **Computed Fields** - Generate slugs, excerpts, reading times
- **Large Dataset Processing** - Batch processing with progress
- **Enum Migration** - Transform status values
- **Multi-Table Sync** - Aggregate counts across tables

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
| `rollback` | Rollback last migration |
| `reset` | Clear migration records |

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
npx prisma-shift run # Data migrations
npm start
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

```bash
# Environment variables
DATA_MIGRATIONS_DIR=./prisma/data-migrations
DATA_MIGRATIONS_TABLE=_dataMigration
```

```typescript
// Options
interface MigrationOptions {
  migrationsDir: string;      // Migration files directory
  migrationsTable?: string;   // History table (default: "_dataMigration")
  schemaPath?: string;        // Prisma schema path
  autoRun?: boolean;          // Auto-run on startup
}
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
}
```

### MigrationContext

```typescript
interface MigrationContext {
  prisma: PrismaClient;
  log: (message: string) => void;
}
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
- [Unified Demo](./examples/unified-demo/) - Complete example with 3 schema + 8 data migrations

## License

MIT
