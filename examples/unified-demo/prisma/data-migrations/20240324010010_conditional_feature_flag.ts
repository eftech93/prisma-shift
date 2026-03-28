/**
 * PHASE 10: Conditional Migration with Feature Flag
 * 
 * Demonstrates: Conditional migrations that only run based on database state
 * 
 * This migration only runs if a specific feature flag is enabled in the database.
 * Shows how to use the `condition` property to control migration execution.
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010010_conditional_feature_flag",
  name: "conditional_feature_flag",
  createdAt: 1711238410000,

  /**
   * Condition: Only run this migration if analytics feature is enabled
   * In a real app, this might check a config table or environment variable
   */
  condition: async ({ prisma }) => {
    // For demo purposes, we'll check if there are more than 3 posts
    // In production, you might check: await prisma.config.findFirst({ where: { key: 'analytics_enabled' } })
    const postCount = await prisma.post.count();
    return postCount >= 3;
  },

  async up({ prisma, log }: MigrationContext) {
    log.info("Analytics feature is enabled, setting up analytics data...");

    // Get all posts for analytics processing
    const posts = await prisma.post.findMany({
      include: { stats: true },
    });

    for (const post of posts) {
      // Calculate engagement score (likes + comments + shares) / views
      const stats = post.stats;
      if (stats && stats.viewCount > 0) {
        const engagement = (stats.likeCount + stats.commentCount + stats.shareCount) / stats.viewCount;
        
        // Update post with engagement score (stored in readingTime for demo)
        await prisma.post.update({
          where: { id: post.id },
          data: {
            readingTime: Math.round(engagement * 100), // Store as percentage * 100
          },
        });
        
        log.info(`Updated post ${post.id}: engagement score = ${(engagement * 100).toFixed(2)}%`);
      }
    }

    log.info(`Analytics data setup complete for ${posts.length} posts`);
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Rollback: Clearing analytics data...");
    
    await prisma.post.updateMany({
      data: { readingTime: null },
    });
    
    log.info("Analytics data cleared");
  },
};

export default migration;
