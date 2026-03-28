# Configuration

## Config File

Create `prisma-shift.config.ts`:

```typescript
import { Config } from "prisma-shift";

export default {
  migrationsDir: "./prisma/data-migrations",
  migrationsTable: "_dataMigration",
  schemaPath: "./prisma/schema.prisma",
  
  logging: {
    level: "info",
    progress: true,
    format: "text",
  },
  
  lock: {
    enabled: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  execution: {
    timeout: 0,
    transaction: true,
  },
  
  typescript: {
    compiler: "tsx",
    transpileOnly: true,
  },
} satisfies Config;
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATA_MIGRATIONS_DIR` | Migrations directory |
| `DATA_MIGRATIONS_TABLE` | History table name |
| `DATA_MIGRATIONS_LOG_LEVEL` | Log level |
| `DATA_MIGRATIONS_NO_PROGRESS` | Disable progress |

## Priority

CLI flags > Environment variables > Config file > Defaults
