# Unified Demo: Complete Blog Platform Evolution

A comprehensive example demonstrating:
- **3 schema migrations** (Prisma SQL)
- **12 data migrations** (TypeScript) including advanced features
- **Configuration file** (`prisma-shift.config.ts`)
- **Lifecycle hooks** (backup & notification scripts)

This demo showcases all features of Prisma Shift including batch processing, conditional migrations, distributed locking, and more.

## 🚀 Quick Start (One Command!)

```bash
# Start infrastructure, run migrations, and start the demo
npm install && npm start
```

Or step by step:

```bash
# 1. Start the database
npm run infra:up

# 2. Run all migrations (schema + data)
npm run migrate

# 3. Start the demo app
npm run dev
```

## 📋 Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 18+ and npm
- (Optional) Make (for using convenient commands)

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start infra + run all migrations (one command!) |
| `npm run infra:up` | Start Docker containers (PostgreSQL + Adminer) |
| `npm run infra:down` | Stop Docker containers |
| `npm run migrate` | Wait for DB, then run schema + data migrations |
| `npm run dev` | Run the demo application |
| `npm run studio` | Open Prisma Studio (DB UI at localhost:5555) |
| `npm run data:status` | Check migration status |
| `npm run data:create <name>` | Create a new data migration |

## 🏃 Step-by-Step Guide

### Step 1: Start the Database

```bash
npm run infra:up
```

This starts:
- **PostgreSQL** on port 5432
- **Adminer** (DB UI) on http://localhost:8080

The migrate command will automatically wait for the database to be ready.

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `@prisma/client` - Prisma ORM
- `prisma-shift` - This library (linked from parent)
- `ts-node` - Run TypeScript directly
- TypeScript and other dev dependencies

### Step 3: Setup Environment

```bash
# Copy environment template
cp .env.example .env

# The default values work with Docker Compose
# No changes needed unless you modified docker-compose.yml
```

### Step 4: Run Migrations (One Command!)

**Option A: Using the unified deploy command (recommended)**

```bash
# One command runs everything:
# - Schema migrations (prisma migrate deploy)
# - Generate Prisma Client (prisma generate)
# - Data migrations (prisma-shift run)
npx prisma-shift deploy
```

**Option B: Using the deploy script**

```bash
./deploy.sh
```

**Option C: Using Make**

```bash
make deploy
```

**Option D: Step by step (if you need more control)**

```bash
# Schema migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Data migrations
npx prisma-shift run
```

### Step 5: View Results

**Run the demo application:**

```bash
# Using npm
npm run dev

# Or using Make
make demo
```

This shows:
- Users with profiles
- Categories
- Posts with all generated fields
- Tags
- Statistics

**View in Prisma Studio:**

```bash
# Using npm
npm run studio

# Or using Make
make studio
```

Opens http://localhost:5555 for visual database exploration.

**View in Adminer (DB UI):**

Open http://localhost:8080 and login with:
- System: PostgreSQL
- Server: postgres
- Username: bloguser
- Password: blogpass
- Database: blog_demo

## 🧹 Cleanup

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (deletes all data)
docker-compose down -v

# Or using Make
make down      # Stop only
make clean     # Stop and remove everything
```

## 📚 What's Included

### Schema Migrations (3 SQL Files)

| Migration | Creates/Adds | Purpose |
|-----------|--------------|---------|
| `01_init` | User, Post tables | Initial schema |
| `02_add_categories_and_profiles` | Category table, profile fields | Features & user profiles |
| `03_add_tags_content_and_stats` | Tag, PostStats tables, content fields | Complete feature set |

### Data Migrations (12 TypeScript Files)

| Migration | Pattern | What It Does |
|-----------|---------|--------------|
| `01_load_seed_data.ts` | JSON Loading | Loads users/posts from JSON files |
| `02_setup_categories.ts` | Backfill | Creates categories, assigns to posts |
| `03_setup_user_profiles.ts` | Config Loading | Applies settings, generates avatars |
| `04_import_tags.ts` | Many-to-Many | Imports tags, links to posts |
| `05_generate_content_fields.ts` | Computed Fields | Generates slugs, excerpts, reading time |
| `06_aggregate_post_stats.ts` | Large Dataset | Batch processes stats with progress |
| `07_migrate_status_values.ts` | Enum Migration | `draft` → `DRAFT`, adds publishedAt |
| `08_sync_user_counts.ts` | Multi-Table Sync | Aggregates post counts per user |
| `09_batch_reindex_posts.ts` | Batch Processing | Reindex posts with progress tracking |
| `10_conditional_feature_flag.ts` | Conditional | Only runs if feature flag is enabled |
| `11_dependency_migration.ts` | Dependencies | Ensures prerequisites are met first |
| `12_long_running_with_timeout.ts` | Long-Running | Custom timeout, outside transaction |

## 🔄 Reset and Replay

To run through all migrations again:

```bash
# Using Make (easiest)
make reset

# Or manually
npx prisma migrate reset --force
npx prisma-shift deploy
```

## 🐛 Troubleshooting

### "Cannot connect to database"

```bash
# Check if database is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### "Table does not exist" or "Column does not exist"

You likely ran data migrations before schema migrations. Run in correct order:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma-shift run
```

### "Cannot find module '@prisma/client'"

```bash
npm install
npx prisma generate
```

### "Permission denied" when running deploy.sh

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🗂️ Project Structure

```
unified-demo/
├── docker-compose.yml                   # PostgreSQL + Adminer
├── Makefile                             # Convenient commands
├── deploy.sh                            # One-command deployment
├── .env.example                         # Environment template
│
├── data/                                # JSON data files
│   ├── seed-users.json                  # 4 users
│   ├── seed-posts.json                  # 5 posts
│   ├── categories.json                  # 5 categories
│   ├── tags.json                        # 10 tags
│   └── default-settings.json            # User settings config
│
├── prisma/
│   ├── schema.prisma                    # Final Prisma schema
│   │
│   ├── migrations/                      # 📦 SCHEMA MIGRATIONS (SQL)
│   │   ├── 20240324000001_init/
│   │   ├── 20240324000002_add_categories_and_profiles/
│   │   └── 20240324000003_add_tags_content_and_stats/
│   │
│   └── data-migrations/                 # 🔧 DATA MIGRATIONS (TS)
│       ├── 01_load_seed_data.ts
│       ├── 02_setup_categories.ts
│       ├── 03_setup_user_profiles.ts
│       ├── 04_import_tags.ts
│       ├── 05_generate_content_fields.ts
│       ├── 06_aggregate_post_stats.ts
│       ├── 07_migrate_status_values.ts
│       ├── 08_sync_user_counts.ts
│       ├── 09_batch_reindex_posts.ts
│       ├── 10_conditional_feature_flag.ts
│       ├── 11_dependency_migration.ts
│       └── 12_long_running_with_timeout.ts
│
└── src/
    └── app.ts                           # Demo application

```

## 📖 Migration Sequence

```
PHASE 1: Initial Setup
├── Schema: 01_init.sql
├── Generate: prisma generate
└── Data: 01_load_seed_data.ts

PHASE 2: Categories & Profiles
├── Schema: 02_add_categories_and_profiles.sql
├── Generate: prisma generate
├── Data: 02_setup_categories.ts
└── Data: 03_setup_user_profiles.ts

PHASE 3: Tags, Content, Stats & Status
├── Schema: 03_add_tags_content_and_stats.sql
├── Generate: prisma generate
├── Data: 04_import_tags.ts
├── Data: 05_generate_content_fields.ts
├── Data: 06_aggregate_post_stats.ts
├── Data: 07_migrate_status_values.ts
└── Data: 08_sync_user_counts.ts

PHASE 4: Advanced Features
├── Data: 09_batch_reindex_posts.ts (Batch processing)
├── Data: 10_conditional_feature_flag.ts (Conditional)
├── Data: 11_dependency_migration.ts (Dependencies)
└── Data: 12_long_running_with_timeout.ts (Timeout + No Tx)
```

## 🔥 Advanced Features Demonstrated

### Phase 9: Batch Processing (`09_batch_reindex_posts.ts`)
Demonstrates processing large datasets in batches with progress tracking.
```bash
# Run just this migration
npx prisma-shift run
```
**Features shown:**
- `batch()` helper for chunked processing
- Progress indicators
- Error collection per batch

### Phase 10: Conditional Migration (`10_conditional_feature_flag.ts`)
Only runs if a condition is met (e.g., feature flag enabled).
**Features shown:**
- `condition` property for runtime checks
- Database state-dependent execution

### Phase 11: Migration Dependencies (`11_dependency_migration.ts`)
Ensures prerequisite migrations are executed first.
**Features shown:**
- `requiresData` for data migration dependencies
- Validation that dependencies exist

### Phase 12: Long Running with Timeout (`12_long_running_with_timeout.ts`)
Demonstrates custom timeouts and running outside transactions.
**Features shown:**
- `timeout` property for long operations
- `disableTransaction` for operations that need to commit incrementally
- Progress logging

### Configuration (`prisma-shift.config.ts`)
Centralized configuration for all features:
```typescript
export default {
  lock: { enabled: true },        // Distributed locking
  logging: { level: "info" },      // Structured logging
  hooks: {                        // Lifecycle hooks
    beforeAll: "./scripts/backup.ts",
    afterAll: "./scripts/notify.ts",
  },
} satisfies Config;
```

### Testing Distributed Locking
To test the locking mechanism, try running migrations in two terminals simultaneously:

**Without `--wait` (fails fast):**
```bash
# Terminal 1 - Start a long migration
npx prisma-shift run

# Terminal 2 (while Terminal 1 is running) - Fails immediately
npx prisma-shift run
# Error: Could not acquire migration lock. Another instance may be running migrations.
```

**With `--wait` (waits for lock):**
```bash
# Terminal 1 - Start a long migration
npx prisma-shift run

# Terminal 2 (while Terminal 1 is running) - Waits patiently
npx prisma-shift run --wait
# Waiting to acquire migration lock...
# Another instance is running migrations. Waiting...
# Lock acquired after N attempt(s)
```

### Testing Hooks
Enable hooks in `prisma-shift.config.ts`:
```typescript
hooks: {
  beforeAll: "./scripts/backup.ts",
  afterAll: "./scripts/notify.ts",
}
```
Then run migrations to see hooks execute.

## 🎯 Make Commands

```bash
make up          # Start database
make down        # Stop database
make logs        # View database logs
make deploy      # Run all migrations (schema + data) - RECOMMENDED
make reset       # Reset and re-run all migrations
make demo        # Run demo app
make studio      # Open Prisma Studio
make clean       # Remove everything
```

**Note:** `make deploy` uses the unified `npx prisma-shift deploy` command which runs schema migrations, generates the client, and runs data migrations in sequence.

Run `make` without arguments to see all available commands.

## 🔗 Useful Links

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Adminer](https://www.adminer.org/) - Database management tool
