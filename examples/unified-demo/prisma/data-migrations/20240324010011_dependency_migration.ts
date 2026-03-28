/**
 * PHASE 11: Migration with Dependencies
 * 
 * Demonstrates: Migration dependencies - ensuring prerequisites are met
 * 
 * This migration depends on previous migrations being executed first.
 * It will fail validation if dependencies are not met.
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010011_dependency_migration",
  name: "dependency_migration",
  createdAt: 1711238411000,

  /**
   * Declare dependencies on previous data migrations
   * This ensures proper ordering even if file timestamps are incorrect
   */
  requiresData: [
    "20240324010009_batch_reindex_posts",  // Need the reindex first
    "20240324010010_conditional_feature_flag", // Need analytics setup
  ],

  async up({ prisma, log }: MigrationContext) {
    log.info("Running dependent migration...");
    log.info("Dependencies verified: batch reindex and feature flag migrations completed");

    // This migration relies on data from previous migrations
    const posts = await prisma.post.findMany({
      where: {
        // Posts should have been reindexed (viewCount > 0)
        viewCount: { gt: 0 },
      },
      include: { stats: true },
    });

    log.info(`Found ${posts.length} posts that have been reindexed`);

    // Create a summary report (simulated by creating a special post for demo)
    const summaryId = `summary_${Date.now()}`;
    const summaryPost = await prisma.post.create({
      data: {
        id: summaryId,
        title: "Migration Summary Report",
        content: `Summary of migrations:\n` +
          `- Total posts processed: ${posts.length}\n` +
          `- Total views: ${posts.reduce((sum, p) => sum + p.viewCount, 0)}\n` +
          `- Posts with stats: ${posts.filter(p => p.stats).length}`,
        state: "DRAFT",
        authorId: "user_001", // Admin user
      },
    });

    log.info(`Created summary report: ${summaryPost.id}`);
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Rollback: Removing summary report...");
    
    await prisma.post.deleteMany({
      where: { id: { startsWith: "summary_" } },
    });
    
    log.info("Summary report removed");
  },
};

export default migration;
