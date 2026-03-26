# Prisma Integration Guide

This guide shows how to integrate `prisma-shift` seamlessly with Prisma's CLI, so data migrations run automatically after schema migrations.

## Overview

There are three ways to integrate:

1. **Generator** (Recommended) - Prisma-native generator that auto-runs after migrations
2. **Prisma CLI Wrapper** - Drop-in replacement for `prisma` command
3. **Manual** - Run the unified `deploy` command

---

## Option 1: Generator Integration (Recommended)

Add a generator to your `schema.prisma` that auto-runs data migrations after `prisma migrate deploy`. This is the most Prisma-native approach.

### Installation

Already included when you install `prisma-shift`:

```bash
npm install prisma-shift
```

### Setup

Add this to your `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

generator dataMigration {
  provider      = "prisma-shift-generator"
  migrationsDir = "./prisma/data-migrations"  // optional
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Usage

Simply run Prisma migrate commands as usual:

```bash
npx prisma migrate deploy  # Automatically runs data migrations too!
```

Or with the wrapper (sets `PRISMA_DATA_MIGRATION_AUTO_RUN` automatically):

```bash
npx prisma-shift-migrate migrate deploy
```

### How it works

The generator runs after `prisma generate`. When `PRISMA_DATA_MIGRATION_AUTO_RUN=true` is set (automatic with the wrapper), it:
1. Creates a Prisma Client
2. Runs pending data migrations
3. Reports results

### Package.json Scripts

```json
{
  "scripts": {
    "migrate": "prisma-shift-migrate migrate deploy",
    "migrate:dev": "prisma-shift-migrate migrate dev",
    "generate": "prisma-shift-migrate generate"
  }
}
```

Then simply run:

```bash
npm run migrate
```

This will deploy schema migrations **and** data migrations in one command!

---

## Option 2: Prisma CLI Wrapper

Use `prisma-shift-migrate` as a drop-in replacement for the `prisma` command.

### Setup

Already included when you install `prisma-shift`:

```bash
npm install prisma-shift
```

### Usage

Simply replace `prisma` with `prisma-shift-migrate` in your commands:

```bash
# Instead of:
# npx prisma migrate deploy

# Use:
npx prisma-shift-migrate migrate deploy
```

### What it does

When you run migrate commands, it automatically:
1. Runs `prisma migrate deploy` (schema migrations)
2. Generates Prisma Client
3. Runs data migrations

### Skipping Data Migrations

To skip data migrations (e.g., during CI build):

```bash
# Only schema migrations and client generation
npx prisma generate

# Or without the wrapper
npx prisma migrate deploy  # Won't run data migrations
```

---

## Option 3: Manual Integration

Use the unified `deploy` command when you want explicit control.

```bash
# Runs everything in sequence
npx prisma-shift deploy
```

This is equivalent to:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma-shift run
```

---

## Comparison

| Approach | Command | Auto-runs Data Migrations | Best For |
|----------|---------|---------------------------|----------|
| **Generator** | `npx prisma migrate deploy` | ✅ Yes | Most Prisma-native approach |
| **CLI Wrapper** | `npx prisma-shift-migrate migrate deploy` | ✅ Yes | Drop-in replacement |
| **Unified Deploy** | `npx prisma-shift deploy` | ✅ Yes | One-off deployments |
| **Separate** | `npx prisma migrate deploy && npx prisma-shift run` | ❌ Manual | Fine-grained control |

---

## Recommended Workflow

### Development

```bash
# Start database
docker-compose up -d

# Run migrations (schema + data)
npx prisma-shift-migrate migrate dev

# Or with a script
npm run migrate:dev
```

### Production Deployment

```bash
# Option 1: Using wrapper
npx prisma-shift-migrate migrate deploy

# Option 2: Using unified command
npx prisma-shift deploy

# Option 3: Using generator with env var
PRISMA_DATA_MIGRATION_AUTO_RUN=true npx prisma migrate deploy
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
- name: Deploy migrations
  run: npx prisma-shift deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Troubleshooting

### "prisma-shift-migrate: command not found"

Make sure the package is installed:

```bash
npm install prisma-shift
```

### Data migrations not running

Check that:
1. You're using the wrapper CLI: `prisma-shift-migrate`
2. Or you've set `PRISMA_DATA_MIGRATION_AUTO_RUN=true`
3. Or you're using `npx prisma-shift deploy`

### Generator not running

The generator only runs after `prisma generate` (triggered by migrate commands). Make sure:
1. The generator is defined in `schema.prisma`
2. You're using the wrapper CLI (`prisma-shift-migrate`) OR have set `PRISMA_DATA_MIGRATION_AUTO_RUN=true`
3. You're running a command that triggers generation (`migrate deploy`, `migrate dev`)

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRISMA_DATA_MIGRATION_AUTO_RUN` | Enable auto-run in generator | `false` |
| `DATA_MIGRATIONS_DIR` | Migrations directory | `./prisma/data-migrations` |
| `DATA_MIGRATIONS_TABLE` | Tracking table name | `_dataMigration` |

### Generator Config

```prisma
generator dataMigration {
  provider      = "prisma-shift-generator"
  migrationsDir = "./custom/migrations"    // optional
  migrationsTable = "_customMigrations"    // optional
}
```
