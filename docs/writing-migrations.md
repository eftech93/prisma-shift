# Writing Migrations

## Migration File Structure

A data migration file exports a `DataMigration` object with the following structure:

```typescript
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  // Required fields
  id: "20240324120000_migration_name",
  name: "migration_name",
  createdAt: 1711281600000,
  
  // Required function
  async up(context: MigrationContext) {
    // Migration logic
  },
  
  // Optional rollback function
  async down(context: MigrationContext) {
    // Rollback logic
  },
  
  // Optional configuration
  condition?: async (context) => boolean,
  requiresSchema?: string[],
  requiresData?: string[],
  timeout?: number,
  disableTransaction?: boolean,
};

export default migration;
```

## Required Fields

### `id`

Unique identifier for the migration. Recommended format:

```typescript
id: "YYYYMMDDhhmmss_descriptive_name"
```

**Example:**
```typescript
id: "20240324120000_add_user_preferences"
```

### `name`

Human-readable description (used in logs).

```typescript
name: "add_user_preferences"
```

### `createdAt`

Unix timestamp (milliseconds) for ordering.

```typescript
// Get current timestamp
createdAt: Date.now()

// Or specific date
createdAt: new Date("2024-03-24T12:00:00Z").getTime()
```

### `up`

The main migration function.

```typescript
async up({ prisma, log, batch, progress, signal }: MigrationContext) {
  // Your migration logic here
}
```

## MigrationContext

The `up` and `down` functions receive a `MigrationContext` object:

| Property | Type | Description |
|----------|------|-------------|
| `prisma` | `PrismaClient` | Prisma Client instance |
| `log` | `CallableLogger` | Logging function |
| `batch` | `BatchFunction` | Batch processing helper |
| `progress` | `ProgressFunction` | Progress tracking |
| `signal` | `AbortSignal?` | For cancellation/timeouts |

### Using `prisma`

```typescript
async up({ prisma }) {
  // Query data
  const users = await prisma.user.findMany({
    where: { preferences: null }
  });
  
  // Update data
  await prisma.user.updateMany({
    where: { id: { in: users.map(u => u.id) } },
    data: { preferences: { theme: "light" } }
  });
}
```

### Using `log`

The logger can be called as a function or with methods:

```typescript
async up({ log }) {
  // Simple logging (defaults to info level)
  log("Starting migration...");
  
  // Explicit log levels
  log.debug("Debug information");
  log.info("Processing 100 records");
  log.warn("This might take a while");
  log.error("Something went wrong", { error });
}
```

### Using `batch`

Process large datasets in chunks:

```typescript
async up({ batch, log }) {
  await batch({
    // Query function that fetches items
    query: () => prisma.post.findMany({
      where: { processed: false }
    }),
    
    // Batch size
    batchSize: 1000,
    
    // Process each batch
    process: async (posts) => {
      await prisma.post.updateMany({
        where: { id: { in: posts.map(p => p.id) } },
        data: { processed: true }
      });
    },
    
    // Progress callback
    onProgress: (processed, total) => {
      log(`Processed ${processed}/${total}`);
    }
  });
}
```

### Using `progress`

For custom progress tracking:

```typescript
async up({ progress, log }) {
  const items = await prisma.post.findMany();
  const tracker = progress(items.length);
  
  for (const item of items) {
    await processItem(item);
    tracker.increment();
  }
  
  tracker.done();
}
```

### Using `signal`

Handle timeouts and cancellation:

```typescript
async up({ prisma, log, signal }) {
  const posts = await prisma.post.findMany();
  
  for (const post of posts) {
    // Check if migration should abort
    if (signal?.aborted) {
      throw new Error("Migration was cancelled: " + signal.reason);
    }
    
    await processPost(post);
  }
}
```

## Optional Configuration

### `down` (Rollback)

Provide a rollback function for reverting changes:

```typescript
async down({ prisma, log }) {
  await prisma.user.updateMany({
    data: { preferences: null }
  });
  
  log("Cleared user preferences");
}
```

<div class="warn">
Rollbacks are not always possible (e.g., after data has been modified by users). Design migrations to be idempotent when possible.
</div>

### `condition`

Only run migration if a condition is met:

```typescript
const migration: DataMigration = {
  id: "20240325120000_enable_feature",
  name: "enable_feature",
  
  condition: async ({ prisma }) => {
    const config = await prisma.config.findFirst();
    return config?.featureEnabled === true;
  },
  
  async up({ prisma, log }) {
    log("Feature is enabled, running migration...");
    // Migration logic
  }
};
```

### `requiresSchema`

Declare dependencies on schema migrations:

```typescript
const migration: DataMigration = {
  id: "20240325_add_user_stats",
  name: "add_user_stats",
  
  requiresSchema: [
    "20240324000002_add_categories"  // Schema migration name
  ],
  
  async up({ prisma }) {
    // Can safely use the new schema
  }
};
```

### `requiresData`

Declare dependencies on other data migrations:

```typescript
const migration: DataMigration = {
  id: "20240325_calculate_scores",
  name: "calculate_scores",
  
  requiresData: [
    "20240324010003_setup_profiles"  // Data migration ID
  ],
  
  async up({ prisma }) {
    // Profiles are guaranteed to exist
  }
};
```

### `timeout`

Set a custom timeout (milliseconds):

```typescript
const migration: DataMigration = {
  id: "20240325_backfill_large_table",
  name: "backfill_large_table",
  
  timeout: 300000,  // 5 minutes
  
  async up({ prisma, signal }) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error("Timeout!");
    }
    // Long-running work...
  }
};
```

### `disableTransaction`

Run outside a transaction (use with caution):

```typescript
const migration: DataMigration = {
  id: "20240325_long_operation",
  name: "long_operation",
  
  disableTransaction: true,  // Commits incrementally
  
  async up({ prisma, log }) {
    // Each operation commits immediately
    // WARNING: Partial failures won't auto-rollback
  }
};
```

<div class="warn">
Only use `disableTransaction` when necessary (e.g., very long operations that exceed transaction timeouts). Provide a `down` function for manual rollback.
</div>

## Common Patterns

### Loading JSON Data

```typescript
import * as fs from "fs";
import * as path from "path";

async up({ prisma, log }) {
  const dataPath = path.join(__dirname, "../data/users.json");
  const users = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  
  for (const userData of users) {
    await prisma.user.create({ data: userData });
  }
  
  log(`Created ${users.length} users`);
}
```

### Idempotent Updates

```typescript
async up({ prisma, log }) {
  // Only process records that haven't been migrated
  const posts = await prisma.post.findMany({
    where: { slug: null }
  });
  
  for (const post of posts) {
    await prisma.post.update({
      where: { id: post.id },
      data: { slug: generateSlug(post.title) }
    });
  }
  
  log(`Generated slugs for ${posts.length} posts`);
}
```

### Computed Fields

```typescript
async up({ prisma, log }) {
  const posts = await prisma.post.findMany();
  
  for (const post of posts) {
    const wordCount = post.content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // 200 WPM
    
    await prisma.post.update({
      where: { id: post.id },
      data: {
        excerpt: post.content.slice(0, 200) + "...",
        readingTime
      }
    });
  }
}
```

### Enum Migration

```typescript
async up({ prisma, log }) {
  // Migrate status values
  const posts = await prisma.post.findMany();
  
  for (const post of posts) {
    const newStatus = post.status === "draft" ? "DRAFT" :
                      post.status === "published" ? "PUBLISHED" :
                      "ARCHIVED";
    
    await prisma.post.update({
      where: { id: post.id },
      data: { status: newStatus }
    });
  }
}
```

### Multi-Table Sync

```typescript
async up({ prisma, log }) {
  // Aggregate post counts per user
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    const count = await prisma.post.count({
      where: { authorId: user.id }
    });
    
    await prisma.user.update({
      where: { id: user.id },
      data: { postCount: count }
    });
  }
}
```

## Best Practices

1. **Make migrations idempotent** - Can be run multiple times safely
2. **Log progress** - Use `log()` to track what's happening
3. **Handle large datasets** - Use `batch()` for big tables
4. **Check for cancellation** - Respect `signal.aborted` in long migrations
5. **Provide rollback** - Implement `down()` when possible
6. **Test locally** - Use `--dry-run` to preview changes
7. **Use transactions** - Keep `disableTransaction: false` (default) unless necessary
