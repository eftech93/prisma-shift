# Distributed Locking

Prevent concurrent migrations in multi-instance deployments.

## How It Works

<div class="diagram">

```mermaid
sequenceDiagram
    participant Instance1
    participant DB as PostgreSQL
    participant Instance2
    
    Instance1->>DB: pg_advisory_lock('migration_lock')
    DB-->>Instance1: Lock Acquired
    
    Instance2->>DB: pg_advisory_lock('migration_lock')
    DB-->>Instance2: Lock Failed
    
    Instance1->>DB: Run Migrations
    Instance1->>DB: pg_advisory_unlock()
    
    Instance2->>DB: pg_advisory_lock('migration_lock')
    DB-->>Instance2: Lock Acquired
    Instance2->>DB: Run Migrations
```

</div>

## Configuration

```typescript
// prisma-shift.config.ts
export default {
  lock: {
    enabled: true,
    timeout: 30000,      // Lock expires after 30s
    retryAttempts: 3,    // Retry 3 times
    retryDelay: 1000,    // Wait 1s between retries
  },
};
```

## CLI Usage

### Fail Fast (Default)

```bash
npx prisma-shift run
# Error: Could not acquire migration lock. Another instance may be running migrations.
```

### Wait for Lock

```bash
npx prisma-shift run --wait
# Waiting to acquire migration lock...
# Another instance is running migrations. Waiting...
# Lock acquired after 4 attempt(s)
```

## Heartbeat

Locks are automatically extended while migrations are running.

## Fallback

For non-PostgreSQL databases, a table-based lock is used.
