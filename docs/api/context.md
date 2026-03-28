# MigrationContext

The `MigrationContext` is passed to all migration functions (`up`, `down`, `condition`).

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `prisma` | `PrismaClient` | Prisma Client instance |
| `log` | `CallableLogger` | Logging function |
| `batch` | `BatchFunction` | Batch processing helper |
| `progress` | `ProgressFunction` | Progress tracking |
| `signal` | `AbortSignal?` | For cancellation/timeouts |

## prisma

The Prisma Client instance.

```typescript
async up({ prisma }) {
  const users = await prisma.user.findMany();
  await prisma.user.updateMany({...});
}
```

## log

Callable logger with method shortcuts.

```typescript
async up({ log }) {
  log("Simple message");
  log.info("Info message");
  log.warn("Warning");
  log.error("Error");
  log.debug("Debug");
}
```

## batch

Batch processing for large datasets.

```typescript
async up({ batch }) {
  await batch({
    query: () => prisma.post.findMany(),
    batchSize: 1000,
    process: async (posts) => { /* ... */ },
    onProgress: (processed, total) => { /* ... */ },
  });
}
```

## progress

Create a progress tracker.

```typescript
async up({ progress, log }) {
  const items = await prisma.post.findMany();
  const tracker = progress(items.length);
  
  for (const item of items) {
    await process(item);
    tracker.increment();
  }
  
  tracker.done();
}
```

## signal

Check for cancellation/timeouts.

```typescript
async up({ signal }) {
  if (signal?.aborted) {
    throw new Error("Cancelled: " + signal.reason);
  }
}
```
