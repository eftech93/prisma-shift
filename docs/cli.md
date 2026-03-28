# CLI Commands

## Overview

Prisma Shift provides a comprehensive CLI for managing data migrations. All commands support the global options listed below.

## Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir <directory>` | Migrations directory | `./prisma/data-migrations` |
| `-t, --table <table>` | Migrations table name | `_dataMigration` |
| `--log-level <level>` | Log level (silent/error/warn/info/debug) | `info` |
| `--no-progress` | Disable progress indicators | `false` |

## Commands

### `init`

Initialize data migrations in your project.

```bash
npx prisma-shift init [options]
```

**Options:**
- `--config` - Create a config file (`prisma-shift.config.ts`)

**Example:**
```bash
npx prisma-shift init --config
```

**Output:**
```
✓ Created config file: prisma-shift.config.ts
✓ Initialized data migrations
  Directory: ./prisma/data-migrations

Next steps:
  1. Add migrations: prisma-shift create <name>
  2. Run migrations: prisma-shift run
```

---

### `create`

Create a new data migration file.

```bash
npx prisma-shift create <name> [options]
```

**Arguments:**
- `name` - Name of the migration (e.g., `add_user_preferences`)

**Options:**
- `-d, --dir <directory>` - Migrations directory

**Example:**
```bash
npx prisma-shift create "add_user_preferences"
```

**Output:**
```
✓ Created migration: prisma/data-migrations/20240324120000_add_user_preferences.ts
  ID: 20240324120000_add_user_preferences
```

**Generated File:**
```typescript
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324120000_add_user_preferences",
  name: "add_user_preferences",
  createdAt: 1711281600000,

  async up({ prisma, log }: MigrationContext) {
    // Migration logic here
  },

  async down({ prisma, log }: MigrationContext) {
    // Rollback logic here
  }
};

export default migration;
```

---

### `run`

Run pending migrations.

```bash
npx prisma-shift run [options]
```

**Options:**
- `--dry-run` - Show what would run without executing
- `--with-schema` - Run Prisma schema migrations first
- `--wait` - Wait for lock if another instance is running

**Examples:**

**Basic run:**
```bash
npx prisma-shift run
```

**With schema migrations:**
```bash
npx prisma-shift run --with-schema
```

**Wait for lock (multi-instance):**
```bash
npx prisma-shift run --wait
```

**Preview changes:**
```bash
npx prisma-shift run --dry-run
```

**Combined (recommended for deployment):**
```bash
npx prisma-shift run --with-schema --wait
```

**Output:**
```
📦 Running Prisma schema migrations...

✓ Schema migrations complete

[04:02:13]  INFO Running 12 migration(s)...
[04:02:13]  INFO [20240324010001_load_seed_data] Starting migration: load_seed_data
[04:02:13]  INFO Created 4 users
[04:02:13]  INFO [20240324010001_load_seed_data] ✓ Migration load_seed_data completed in 16ms
...
[04:02:34]  INFO Successfully executed 12 migration(s)

Total time: 21345ms
Migrations run: 12
```

---

### `status`

Show migration status.

```bash
npx prisma-shift status
```

**Output:**
```
📊 Migration Status

Migrations directory: ./prisma/data-migrations
Migrations table: _dataMigration

ID                             NAME                           STATUS
--------------------------------------------------------------------------------
20240324010001_load_seed_data  load_seed_data                 ✓ executed (2026-03-28T04:03)
20240324010002_setup_categories setup_categories               ✓ executed (2026-03-28T04:03)
20240324010003_setup_user_profiles setup_user_profiles            ○ pending

Total: 2 executed, 1 pending
```

---

### `validate`

Validate migration files without running them.

```bash
npx prisma-shift validate
```

**Checks:**
- All migrations have valid IDs
- No duplicate IDs
- TypeScript compiles without errors
- No conflicts with executed migrations

**Output (Success):**
```
✓ All migrations are valid

Checked:
  - 15 migration files
  - 0 duplicates
  - TypeScript compilation: OK
```

**Output (Failure):**
```
✗ Validation failed

Errors:
  - Duplicate ID: 20240324120000_migration_name
    Found in: 20240324120000_migration_name.ts
              20240324120000_migration_name_copy.ts

  - TypeScript Error in 20240324120001_invalid.ts:12
    Cannot find name 'prisma'
```

---

### `rollback`

Rollback the last executed migration.

```bash
npx prisma-shift rollback
```

**Warning:** Only rolls back the migration record and runs the `down()` function. Data changes may not be reversible depending on the migration.

**Output:**
```
Rolling back: 20240324010012_long_running_with_timeout
✓ Rollback complete
```

---

### `reset`

Clear all migration records (dangerous operation).

```bash
npx prisma-shift reset [options]
```

**Options:**
- `-f, --force` - Skip confirmation

**Warning:** This only clears the migration records from the database. It does NOT rollback any data changes.

**Example:**
```bash
npx prisma-shift reset --force
```

**Output:**
```
⚠️  All migration records cleared
```

---

### `export`

Export migration history to various formats.

```bash
npx prisma-shift export [options]
```

**Options:**
- `--format <format>` - Output format: `json`, `csv`, `html` (default: `json`)
- `--output <file>` - Output file path

**Examples:**

**JSON:**
```bash
npx prisma-shift export --format=json > migrations.json
```

**CSV:**
```bash
npx prisma-shift export --format=csv > migrations.csv
```

**HTML:**
```bash
npx prisma-shift export --format=html --output=report.html
```

**Sample JSON Output:**
```json
{
  "generatedAt": "2026-03-28T04:03:00.000Z",
  "total": 12,
  "executed": 10,
  "pending": 2,
  "migrations": [
    {
      "id": "20240324010001_load_seed_data",
      "name": "load_seed_data",
      "status": "executed",
      "executedAt": "2026-03-28T04:03:00.000Z",
      "duration": 16
    }
  ]
}
```

---

## Prisma CLI Wrapper

### `prisma-shift-migrate`

Drop-in replacement for `prisma` CLI that automatically runs data migrations after schema migrations.

```bash
npx prisma-shift-migrate <prisma-command>
```

**Examples:**

```bash
# Deploy schema + data migrations
npx prisma-shift-migrate migrate deploy

# Development mode
npx prisma-shift-migrate migrate dev

# Generate Prisma Client
npx prisma-shift-migrate generate

# Pull schema from database
npx prisma-shift-migrate db pull

# Push schema to database
npx prisma-shift-migrate db push
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "migrate": "prisma-shift-migrate migrate deploy",
    "migrate:dev": "prisma-shift-migrate migrate dev",
    "db:push": "prisma-shift-migrate db push"
  }
}
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error / Migration failed |
| `2` | Validation error |
| `3` | Lock acquisition failed |

---

## Environment Variables

All CLI options can be set via environment variables:

```bash
# Migrations directory
export DATA_MIGRATIONS_DIR=./prisma/data-migrations

# Migrations table
export DATA_MIGRATIONS_TABLE=_dataMigration

# Log level
export DATA_MIGRATIONS_LOG_LEVEL=info

# Disable progress
export DATA_MIGRATIONS_NO_PROGRESS=true
```

**Priority:** CLI flags > Environment variables > Config file > Defaults
