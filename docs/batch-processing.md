# Batch Processing

Process large datasets efficiently with automatic pagination.

## Basic Usage

```typescript
async up({ batch, log }) {
  await batch({
    query: () => prisma.post.findMany({
      where: { processed: false }
    }),
    batchSize: 1000,
    process: async (posts) => {
      await prisma.post.updateMany({
        where: { id: { in: posts.map(p => p.id) } },
        data: { processed: true }
      });
    },
    onProgress: (processed, total) => {
      log(`Processed ${processed}/${total}`);
    }
  });
}
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `query` | `() => Promise<T[]>` | Function that returns items to process |
| `batchSize` | `number` | Number of items per batch |
| `process` | `(items: T[]) => Promise<void>` | Process each batch |
| `onProgress` | `(processed: number, total: number) => void` | Progress callback |

## Result

```typescript
const result = await batch({...});

console.log(result.processed);  // Total items processed
console.log(result.batches);    // Number of batches
console.log(result.duration);   // Time in ms
console.log(result.errors);     // Any errors per batch
```

## Example: Reindex Posts

```typescript
async up({ prisma, log, batch }) {
  log("Starting batch reindex...");
  
  const result = await batch({
    query: () => prisma.post.findMany({
      select: { id: true }
    }),
    batchSize: 100,
    process: async (posts) => {
      for (const post of posts) {
        await prisma.post.update({
          where: { id: post.id },
          data: { searchVector: generateSearchVector(post) }
        });
      }
    },
    onProgress: (current, total) => {
      log(`Reindexed ${current}/${total} posts`);
    }
  });
  
  log(`Complete! Processed ${result.processed} posts in ${result.batches} batches`);
}
```
