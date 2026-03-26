# Examples

This directory contains a comprehensive example demonstrating all migration scenarios.

## 🎯 Unified Demo

### [unified-demo/](./unified-demo/) ⭐ COMPREHENSIVE EXAMPLE

A complete blog platform evolution showing **3 schema migrations** and **8 data migrations** working together.

```bash
cd unified-demo
npm install
./deploy.sh
```

### What's Included

**Schema Migrations (SQL):**
1. `20240324000001_init` - Creates User and Post tables
2. `20240324000002_add_categories_and_profiles` - Adds Category table and user profile fields
3. `20240324000003_add_tags_content_and_stats` - Adds Tag, PostStats tables, content fields, soft delete

**Data Migrations (TypeScript):**
1. `01_load_seed_data.ts` - Load users/posts from JSON
2. `02_setup_categories.ts` - Create categories, assign posts
3. `03_setup_user_profiles.ts` - Apply settings from JSON
4. `04_import_tags.ts` - Import tags, link to posts
5. `05_generate_content_fields.ts` - Generate slugs, excerpts, reading time
6. `06_aggregate_post_stats.ts` - Batch process stats
7. `07_migrate_status_values.ts` - Migrate enum values
8. `08_sync_user_counts.ts` - Sync post counts

### Project Structure

```
unified-demo/
├── README.md                           # Complete guide
├── package.json                        # Dependencies
├── deploy.sh                           # Deployment script
├── .env.example                        # Environment template
├── data/                               # JSON data files
│   ├── seed-users.json
│   ├── seed-posts.json
│   ├── categories.json
│   ├── tags.json
│   └── default-settings.json
├── prisma/
│   ├── schema.prisma                   # Final schema
│   ├── migrations/                     # 3 Schema migrations (SQL)
│   │   ├── 20240324000001_init/
│   │   ├── 20240324000002_add_categories_and_profiles/
│   │   └── 20240324000003_add_tags_content_and_stats/
│   └── data-migrations/                # 8 Data migrations (TS)
│       ├── 01_load_seed_data.ts
│       ├── 02_setup_categories.ts
│       ├── 03_setup_user_profiles.ts
│       ├── 04_import_tags.ts
│       ├── 05_generate_content_fields.ts
│       ├── 06_aggregate_post_stats.ts
│       ├── 07_migrate_status_values.ts
│       └── 08_sync_user_counts.ts
└── src/
    └── app.ts                          # Demo application
```

### Running the Demo

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 2. Run all migrations
./deploy.sh

# Or step by step:
npx prisma migrate deploy  # Schema migrations
npx prisma generate        # Generate client
npx prisma-shift run # Data migrations

# 3. View results
npm run dev    # Run demo app
npm run studio # Open Prisma Studio
```

### Migration Sequence

```
PHASE 1: Initial Setup
├── Schema: 01_init - Create User, Post tables
├── Generate: prisma generate
└── Data: 01_load_seed_data.ts

PHASE 2: Categories & Profiles  
├── Schema: 02_add_categories_and_profiles
├── Generate: prisma generate
├── Data: 02_setup_categories.ts
└── Data: 03_setup_user_profiles.ts

PHASE 3: Tags, Content & Stats
├── Schema: 03_add_tags_content_and_stats
├── Generate: prisma generate
├── Data: 04_import_tags.ts
├── Data: 05_generate_content_fields.ts
├── Data: 06_aggregate_post_stats.ts
├── Data: 07_migrate_status_values.ts
└── Data: 08_sync_user_counts.ts
```

### Patterns Demonstrated

| Migration | Pattern | Description |
|-----------|---------|-------------|
| 01 | JSON Loading | Load seed data from JSON files |
| 02 | Backfill | Create categories, assign to posts |
| 03 | Config Loading | Apply settings from JSON config |
| 04 | Many-to-Many | Create tags, link to posts |
| 05 | Computed Fields | Generate slugs, excerpts, reading time |
| 06 | Large Dataset | Batch processing with progress |
| 07 | Enum Migration | Transform status values |
| 08 | Multi-Table Sync | Aggregate counts across tables |
