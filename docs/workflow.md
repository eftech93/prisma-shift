# Schema vs Data Migrations Workflow

## Understanding the Difference

| Type | Purpose | Tool | Example |
|------|---------|------|---------|
| **Schema Migration** | Change database structure | `prisma migrate` | Add a column, create table |
| **Data Migration** | Transform existing data | `prisma-shift` | Backfill new column, normalize data |

## The Golden Rule

> **Always apply schema migrations BEFORE data migrations that depend on them.**

## Visual Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ADDING A NEW COLUMN WITH DATA                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SCHEMA MIGRATION (prisma migrate)                                   │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │ Add column to schema.prisma                                  │    │
│     │   model Post {                                               │    │
│     │     ...                                                      │    │
│     │     slug String? @unique  ◄── NEW                            │    │
│     │   }                                                          │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                              ↓                                          │
│  2. GENERATE CLIENT (prisma generate)                                   │
│     └─> Regenerates Prisma Client with new types                        │
│                              ↓                                          │
│  3. DATA MIGRATION (prisma-shift)                                       │
│     ┌─────────────────────────────────────────────────────────────┐    │
│     │ Backfill data for existing records                           │    │
│     │   const posts = await prisma.post.findMany({                 │    │
│     │     where: { slug: null }                                    │    │
│     │   })                                                         │    │
│     │   for (const post of posts) {                                │    │
│     │     await prisma.post.update({                               │    │
│     │       data: { slug: generateSlug(post.title) }               │    │
│     │     })                                                       │    │
│     │   }                                                          │    │
│     └─────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Recommended Workflow

### Scenario: Adding a New Column with Data

Let's say you want to add a `slug` column to posts and populate it for existing posts:

```bash
# Step 1: Modify schema.prisma to add the new column
# model Post {
#   ...
#   slug String? @unique  <-- Add this
# }

# Step 2: Create and apply schema migration
npx prisma migrate dev --name add_slug_to_posts

# Step 3: Generate Prisma Client (important!)
npx prisma generate

# Step 4: Create data migration to backfill slugs
npx prisma-shift create backfill_post_slugs

# Step 5: Write the data migration (see example below)
# Edit: prisma/data-migrations/20240324120000_backfill_post_slugs.ts

# Step 6: Run data migration
npx prisma-shift run
```

### Data Migration for This Scenario

```typescript
// prisma/data-migrations/20240324120000_backfill_post_slugs.ts
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324120000_backfill_post_slugs",
  name: "backfill_post_slugs",
  createdAt: 1711281600000,

  async up({ prisma, log }: MigrationContext) {
    // Find posts without slugs
    const posts = await prisma.post.findMany({
      where: { slug: null },
      select: { id: true, title: true },
    });

    log(`Found ${posts.length} posts without slugs`);

    for (const post of posts) {
      // Generate slug from title
      const baseSlug = post.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      
      // Make unique with post ID
      const slug = `${baseSlug}-${post.id.slice(0, 8)}`;

      await prisma.post.update({
        where: { id: post.id },
        data: { slug },
      });
    }

    log(`Generated slugs for ${posts.length} posts`);
  },

  async down({ prisma, log }: MigrationContext) {
    // Clear all slugs
    const result = await prisma.post.updateMany({
      data: { slug: null },
    });
    log(`Cleared slugs for ${result.count} posts`);
  },
};

export default migration;
```

## Complex Scenario: Multi-Step Refactoring

When you need to refactor data across multiple steps:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REFACTORING: OLD → NEW STRUCTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BEFORE:                    DURING:                    AFTER:          │
│  ┌─────────────┐           ┌─────────────┐            ┌─────────────┐  │
│  │ status      │           │ status      │  ◄── old   │ state       │  │
│  │  "draft"    │    →      │  "draft"    │            │  "DRAFT"    │  │
│  │  "published"│           │  "published"│            │  "PUBLISHED"│  │
│  └─────────────┘           ├─────────────┤            ├─────────────┤  │
│                            │ state       │  ◄── new   │ publishedAt │  │
│                            │  NULL       │            │  Date       │  │
│                            │ publishedAt │            └─────────────┘  │
│                            │  NULL       │                             │
│                            └─────────────┘                             │
│                                                                         │
│  Steps:                                                                 │
│  1. Schema: Add state + publishedAt (keep status)                      │
│  2. Data:   Migrate status → state + publishedAt                       │
│  3. Schema: Remove status                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Add New Structure (Schema Migration)

```bash
# Add new columns while keeping old ones
npx prisma migrate dev --name add_new_status_fields
```

```prisma
// schema.prisma changes:
model Post {
  id        String   @id @default(cuid())
  title     String
  // OLD field - will be removed later
  status    String?  // "draft", "published", "archived"
  
  // NEW fields
  state     String?  // "DRAFT", "PUBLISHED", "ARCHIVED"
  publishedAt DateTime?
}
```

### Step 2: Migrate Data (Data Migration)

```bash
npx prisma-shift create migrate_post_status
```

```typescript
// prisma/data-migrations/20240324130000_migrate_post_status.ts
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324130000_migrate_post_status",
  name: "migrate_post_status",
  createdAt: 1711285200000,

  async up({ prisma, log }: MigrationContext) {
    // Get all posts that haven't been migrated
    const posts = await prisma.post.findMany({
      where: { state: null, status: { not: null } },
    });

    log(`Migrating status for ${posts.length} posts`);

    for (const post of posts) {
      const state = post.status?.toUpperCase();
      let publishedAt: Date | null = null;

      // Set publishedAt for published posts
      if (post.status === "published") {
        publishedAt = post.createdAt; // or new Date()
      }

      await prisma.post.update({
        where: { id: post.id },
        data: { state, publishedAt },
      });
    }

    log(`Migrated ${posts.length} posts`);
  },

  async down({ prisma, log }: MigrationContext) {
    // Revert to old format
    const posts = await prisma.post.findMany({
      where: { state: { not: null } },
    });

    for (const post of posts) {
      await prisma.post.update({
        where: { id: post.id },
        data: { 
          status: post.state?.toLowerCase(),
          state: null,
          publishedAt: null,
        },
      });
    }

    log(`Reverted ${posts.length} posts`);
  },
};

export default migration;
```

### Step 3: Remove Old Structure (Schema Migration)

After confirming the data migration worked:

```bash
# Remove old column
npx prisma migrate dev --name remove_old_status_column
```

```prisma
// schema.prisma changes:
model Post {
  id          String    @id @default(cuid())
  title       String
  // status  String?  <-- REMOVED
  state       String    // Now required
  publishedAt DateTime?
}
```

## Deployment Workflow

### Development

```bash
# 1. Make schema changes
npx prisma migrate dev --name add_feature

# 2. Generate client (usually automatic)
npx prisma generate

# 3. Create data migration
npx prisma-shift create migrate_data

# 4. Test locally
npx prisma-shift run
```

### Production

```bash
# 1. Deploy schema migrations
npx prisma migrate deploy

# 2. Generate client
npx prisma generate

# 3. Run data migrations
npx prisma-shift run
```

Or in your deployment script:

```bash
#!/bin/bash
set -e

echo "📦 Deploying schema migrations..."
npx prisma migrate deploy

echo "🔨 Generating Prisma Client..."
npx prisma generate

echo "🔄 Running data migrations..."
npx prisma-shift run

echo "🚀 Starting application..."
npm start
```

## Best Practices

### 1. Order Matters

Always follow this order:
1. Schema migration (add new structure)
2. Data migration (transform data)
3. Schema migration (remove old structure)

### 2. Idempotency

Data migrations should be idempotent (safe to run multiple times):

```typescript
async up({ prisma, log }: MigrationContext) {
  // Good: Only process unmigrated records
  const posts = await prisma.post.findMany({
    where: { slug: null }, // Only get posts without slugs
  });
  
  // Bad: Would process all posts every time
  // const posts = await prisma.post.findMany();
}
```

### 3. Batching

For large datasets, use batching:

```typescript
async up({ prisma, log }: MigrationContext) {
  const BATCH_SIZE = 1000;
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const users = await prisma.user.findMany({
      where: { migrated: false },
      take: BATCH_SIZE,
    });

    if (users.length === 0) {
      hasMore = false;
      break;
    }

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          normalizedName: user.name?.toLowerCase(),
          migrated: true,
        },
      });
    }

    processed += users.length;
    log(`Processed ${processed} users`);
  }
}
```

### 4. Handling Failures

Migrations run in transactions by default. If one fails, it rolls back:

```typescript
// This will automatically rollback if any update fails
async up({ prisma }: MigrationContext) {
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({...});
    await tx.post.updateMany({...});
  });
}
```

### 5. Coordinating with Team

When working with a team:

1. **Schema migrations** are committed to `prisma/migrations/`
2. **Data migrations** are committed to `prisma/data-migrations/`
3. Both should be in the same PR for related changes
4. CI/CD should run both in sequence

## Common Patterns

### Pattern 1: Backfill New Column

```typescript
// After adding a new column to schema
async up({ prisma, log }: MigrationContext) {
  const users = await prisma.user.findMany({
    where: { displayName: null },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        displayName: user.name || user.email.split('@')[0] 
      },
    });
  }
}
```

### Pattern 2: Split Data

```typescript
// Split fullName into firstName and lastName
async up({ prisma, log }: MigrationContext) {
  const users = await prisma.user.findMany({
    where: { firstName: null },
  });

  for (const user of users) {
    const parts = user.fullName?.split(' ') || ['Unknown'];
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || null,
      },
    });
  }
}
```

### Pattern 3: External Data Import

```typescript
async up({ prisma, log }: MigrationContext) {
  // Fetch from external API or file
  const externalData = await fetch('https://api.example.com/users');
  
  for (const item of externalData) {
    await prisma.user.upsert({
      where: { externalId: item.id },
      create: {
        externalId: item.id,
        name: item.name,
        email: item.email,
      },
      update: {
        name: item.name,
      },
    });
  }
}
```

## Troubleshooting

### "Cannot find module '@prisma/client'"

Run `npx prisma generate` after schema migrations.

### "Column does not exist"

You ran the data migration before the schema migration. Order matters!

### "Migration already exists"

Data migration IDs must be unique. If regenerating, delete the old file first.

### Rollback in Production

Be careful with rollbacks in production. Always have a backup strategy:

```bash
# Backup before major migrations
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Then run migrations
npx prisma migrate deploy
npx prisma-shift run
```
