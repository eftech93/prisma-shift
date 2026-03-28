/**
 * PHASE 9: Batch Reindex Posts
 * 
 * Demonstrates: Batch processing for large datasets
 * 
 * This migration simulates reindexing a large number of posts
 * using the batch processing helper with progress tracking.
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010009_batch_reindex_posts",
  name: "batch_reindex_posts",
  createdAt: 1711238409000,
  
  // Disable transaction for long-running batch processing
  // (Batch operations with many updates can exceed transaction timeouts)
  disableTransaction: true,

  async up({ prisma, log, batch }: MigrationContext) {
    log.info("Starting batch reindex of all posts...");
    
    let processedCount = 0;
    let errorCount = 0;

    // Use the batch helper to process posts in chunks
    // Note: For demo purposes, we limit to first 100 posts to keep it fast
    const result = await batch({
      // Query function that fetches posts
      query: async () => {
        return prisma.post.findMany({
          select: { id: true, title: true, content: true },
          take: 100, // Limit for demo
        });
      },
      batchSize: 10, // Process 10 at a time
      process: async (posts) => {
        // Simulate reindexing work
        for (const post of posts) {
          // In real scenario, this might update a search index
          await prisma.post.update({
            where: { id: post.id },
            data: {
              // Mark as indexed (using viewCount as a proxy for demo)
              viewCount: { increment: 1 },
            },
          });
          processedCount++;
        }
      },
      onProgress: (current, total) => {
        log.info(`Reindexed ${current}${total ? `/${total}` : ""} posts`);
      },
    });

    log.info(`Batch reindex complete!`);
    log.info(`  Processed: ${result.processed} posts`);
    log.info(`  Batches: ${result.batches}`);
    log.info(`  Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      log.info(`  Errors: ${result.errors.length} batches failed`);
      errorCount = result.errors.length;
    }
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Rollback: Resetting view counts...");
    
    // Reset view counts to demonstrate rollback
    await prisma.post.updateMany({
      data: { viewCount: 0 },
    });
    
    log.info("View counts reset");
  },
};

export default migration;
