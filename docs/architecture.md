# Architecture

## System Overview

Prisma Shift is built with a modular architecture that separates concerns while providing a cohesive experience for managing data migrations.

<div class="diagram">

```mermaid
flowchart TB
    subgraph Input["Input Layer"]
        CLI["CLI Commands"]
        API["Programmatic API"]
        GEN["Prisma Generator"]
    end
    
    subgraph Core["Core Engine"]
        direction TB
        RUNNER["MigrationRunner"]
        
        subgraph Services["Services"]
            LOCK["Lock Service"]
            HOOKS["Hook Manager"]
            BATCH["Batch Processor"]
            VAL["Validator"]
        end
        
        subgraph Utils["Utilities"]
            LOG["Logger"]
            CONF["Config Loader"]
            TS["TS Loader"]
        end
    end
    
    subgraph Storage["Storage Layer"]
        FILES["Migration Files (*.ts)"]
        META["_dataMigration Table"]
        LOCKT["_dataMigrationLock Table"]
    end
    
    subgraph Prisma["Prisma Layer"]
        CLIENT["PrismaClient"]
        DB[(Database)]
    end
    
    CLI --> RUNNER
    API --> RUNNER
    GEN --> RUNNER
    
    RUNNER --> LOCK
    RUNNER --> HOOKS
    RUNNER --> BATCH
    RUNNER --> VAL
    
    RUNNER --> LOG
    RUNNER --> CONF
    RUNNER --> TS
    
    LOCK --> LOCKT
    VAL --> FILES
    TS --> FILES
    RUNNER --> META
    
    BATCH --> CLIENT
    HOOKS --> CLIENT
    RUNNER --> CLIENT
    
    CLIENT --> DB
    LOCKT --> DB
    META --> DB
```

</div>

## Migration Execution Flow

<div class="diagram">

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant CLI as CLI
    participant Runner as MigrationRunner
    participant Lock as Lock Service
    participant Hooks as Hook Manager
    participant Mig as Migration
    participant DB as Database
    
    User->>CLI: prisma-shift run
    CLI->>Runner: runMigrations()
    
    Runner->>Lock: acquire()
    alt Lock Available
        Lock-->>Runner: Lock Acquired
    else Lock Taken
        Lock-->>Runner: Lock Failed
        Runner-->>CLI: Error: Another instance running
        CLI-->>User: Exit with error
    end
    
    Runner->>Hooks: runBeforeAll()
    Hooks-->>Runner: Done
    
    loop For Each Pending Migration
        Runner->>Runner: checkDependencies()
        Runner->>Runner: checkCondition()
        
        alt Condition Met
            Runner->>Hooks: runBeforeEach()
            Hooks-->>Runner: Done
            
            Runner->>Mig: up(context)
            Mig->>DB: Query/Update
            DB-->>Mig: Results
            Mig-->>Runner: Success
            
            Runner->>DB: Record Migration
            Runner->>Hooks: runAfterEach()
            Hooks-->>Runner: Done
        else Condition Not Met
            Runner->>Runner: Skip Migration
        end
    end
    
    Runner->>Hooks: runAfterAll()
    Hooks-->>Runner: Done
    
    Runner->>Lock: release()
    Lock-->>Runner: Released
    
    Runner-->>CLI: Results
    CLI-->>User: Success Message
```

</div>

## Data Flow

### 1. Configuration Loading

<div class="diagram">

```mermaid
flowchart LR
    A[Start] --> B{Config File Exists?}
    B -->|Yes| C[Load prisma-shift.config.ts]
    B -->|No| D[Use Default Config]
    C --> E[Merge with CLI Options]
    D --> E
    E --> F[Apply Environment Variables]
    F --> G[Final Configuration]
```

</div>

### 2. Migration Discovery

<div class="diagram">

```mermaid
flowchart TD
    A[Scan migrationsDir] --> B[Find *.ts files]
    B --> C[Parse TypeScript]
    C --> D[Validate Migration Structure]
    D --> E{Valid?}
    E -->|Yes| F[Add to Migration List]
    E -->|No| G[Throw Validation Error]
    F --> H[Sort by createdAt]
    H --> I[Compare with Database]
    I --> J[Identify Pending Migrations]
```

</div>

### 3. Lock Acquisition (Distributed)

<div class="diagram">

```mermaid
flowchart TD
    A[Attempt Lock] --> B[Try Advisory Lock]
    B --> C{Acquired?}
    C -->|Yes| D[Start Heartbeat]
    C -->|No| E{Retry?}
    E -->|Yes| F[Wait retryDelay]
    F --> B
    E -->|No| G[Return False]
    D --> H[Return True]
    
    I[Release Lock] --> J[Stop Heartbeat]
    J --> K[Release Advisory Lock]
    K --> L[Return]
```

</div>

## Component Details

### MigrationRunner

The central orchestrator that coordinates all migration activities.

```typescript
class MigrationRunner {
  constructor(prisma: PrismaClient, options: MigrationOptions)
  
  // Core methods
  async runMigrations(options?: RunOptions): Promise<MigrationResult>
  async rollbackLast(): Promise<boolean>
  async getStatus(): Promise<MigrationStatus>
  
  // Internal
  private async executeMigration(migration: DataMigration)
  private async checkDependencies(migration: DataMigration)
  private async checkCondition(migration: DataMigration)
  private createContext(signal?: AbortSignal): MigrationContext
}
```

### Lock Service

Prevents concurrent migration execution using PostgreSQL advisory locks.

```typescript
interface Lock {
  acquire(): Promise<boolean>
  release(): Promise<void>
  extend(additionalTime: number): Promise<boolean>
  isHeld(): boolean
}

class DatabaseLock implements Lock {
  // Uses pg_advisory_lock for PostgreSQL
  // Falls back to table-based locking for other databases
}
```

### Batch Processor

Handles large dataset processing with pagination and progress tracking.

```typescript
async function batchProcess<T>(options: BatchOptions<T>): Promise<BatchResult<T>>

interface BatchOptions<T> {
  query: () => Promise<T[]>
  batchSize: number
  process: (items: T[]) => Promise<void>
  onProgress?: (processed: number, total: number) => void
}
```

### Hook Manager

Executes lifecycle scripts at various migration stages.

```typescript
class HookManager {
  async runBeforeAll(prisma: PrismaClient, logger: Logger)
  async runBeforeEach(prisma: PrismaClient, logger: Logger, migration: MigrationInfo)
  async runAfterEach(prisma: PrismaClient, logger: Logger, migration: MigrationInfo)
  async runAfterAll(prisma: PrismaClient, logger: Logger)
}
```

## Database Schema

### Migration History Table

```sql
CREATE TABLE "_dataMigration" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL,
  "executedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration" INTEGER NOT NULL  -- milliseconds
);
```

### Lock Table (Fallback)

```sql
CREATE TABLE "_dataMigrationLock" (
  "id" TEXT PRIMARY KEY,
  "acquiredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP NOT NULL
);
```

## File Structure

```
src/
├── index.ts                 # Main exports
├── cli.ts                   # CLI entry point
├── migration-runner.ts      # Core runner
├── types.ts                 # TypeScript interfaces
├── config.ts                # Configuration loading
├── logger.ts                # Structured logging
├── lock.ts                  # Distributed locking
├── hooks.ts                 # Lifecycle hooks
├── batch.ts                 # Batch processing
├── validation.ts            # Migration validation
├── export.ts                # Report export
├── utils.ts                 # Utilities
└── extension.ts             # Prisma Client extension
```

## Extension Points

### Custom Logger

```typescript
const runner = new MigrationRunner(prisma, {
  logger: {
    info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
    error: (msg, error) => console.error(`[ERROR] ${msg}`, error),
    migrationStart: (id) => console.log(`Starting ${id}`),
    migrationEnd: (id, duration) => console.log(`Finished ${id} in ${duration}ms`),
  }
})
```

### Custom Lock

```typescript
const runner = new MigrationRunner(prisma, {
  lock: {
    enabled: true,
    timeout: 60000,
    retryAttempts: 5,
    retryDelay: 2000,
  }
})
```

### Custom Hooks

```typescript
// prisma-shift.config.ts
export default {
  hooks: {
    beforeAll: "./scripts/backup.ts",
    beforeEach: "./scripts/notify-start.ts",
    afterEach: "./scripts/verify.ts",
    afterAll: "./scripts/cleanup.ts",
  }
}
```

## Security Considerations

1. **Lock Timeout**: Prevents deadlocks by auto-expiring locks
2. **Transaction Safety**: Default transaction wrapping prevents partial migrations
3. **Input Validation**: All migration files are validated before execution
4. **Dependency Checking**: Ensures migrations run in correct order

## Performance

- **Batch Processing**: Configurable batch sizes for large datasets
- **Connection Pooling**: Works with Prisma's connection pool
- **Lazy Loading**: Migrations loaded only when needed
- **Heartbeat**: Lock extension prevents timeout during long migrations
