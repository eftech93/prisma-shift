/**
 * PHASE 6.3: Aggregate Post Stats
 * 
 * This migration runs AFTER creating the PostStats table.
 * It demonstrates large dataset processing with batching.
 * Aggregates view counts from legacy viewCount field into new stats table.
 * 
 * Migration Sequence:
 * 6.1 Schema: Create PostStats table
 * 6.2 Generate: prisma generate
 * 6.3 Data: This migration - Aggregate stats ← YOU ARE HERE
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const BATCH_SIZE = 100; // Process in small batches

const migration: DataMigration = {
  id: "20240324010006_aggregate_post_stats",
  name: "aggregate_post_stats",
  createdAt: 1711238406000, // 2024-03-24T00:00:06Z

  async up({ prisma, log }: MigrationContext) {
    // Count total posts needing stats
    const totalPosts = await prisma.post.count({
      where: { stats: { is: null } },
    });

    if (totalPosts === 0) {
      log("All posts already have stats");
      return;
    }

    log(`Aggregating stats for ${totalPosts} posts...`);

    let processed = 0;
    let hasMore = true;
    let lastId: string | undefined;
    const startTime = Date.now();

    while (hasMore) {
      // Get batch of posts without stats
      const posts = await prisma.post.findMany({
        where: {
          stats: { is: null },
          ...(lastId && { id: { gt: lastId } }),
        },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        select: {
          id: true,
          viewCount: true,
          // In real scenario, you'd also count likes, comments, etc.
        },
      });

      if (posts.length === 0) {
        hasMore = false;
        break;
      }

      // Create stats for each post in batch
      for (const post of posts) {
        await prisma.postStats.create({
          data: {
            postId: post.id,
            viewCount: post.viewCount,
            likeCount: 0, // Would calculate from actual data
            commentCount: 0, // Would calculate from actual data
            shareCount: 0,
          },
        });
      }

      processed += posts.length;
      lastId = posts[posts.length - 1].id;

      // Progress logging
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (totalPosts - processed) / rate;
      const percent = ((processed / totalPosts) * 100).toFixed(1);

      log(
        `Progress: ${processed}/${totalPosts} (${percent}%) - ` +
        `ETA: ${Math.ceil(remaining)}s`
      );

      // Brief pause to reduce database load
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Stats aggregation complete! Processed ${processed} posts in ${totalTime}s`);
  },

  async down({ prisma, log }: MigrationContext) {
    log("Removing aggregated stats...");
    
    const result = await prisma.postStats.deleteMany({});
    
    log(`Deleted ${result.count} stats records`);
  },
};

export default migration;
