/**
 * PHASE 12: Long Running Migration with Timeout
 * 
 * Demonstrates: Custom timeout and disabling transactions
 * 
 * This migration shows how to handle long-running operations that might
 * exceed the default timeout or need to run outside a transaction.
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010012_long_running_with_timeout",
  name: "long_running_with_timeout",
  createdAt: 1711238412000,

  /**
   * Custom timeout: Allow up to 2 minutes for this migration
   * Default is 0 (no timeout), but this shows how to set one
   */
  timeout: 120000, // 2 minutes

  /**
   * Disable transaction for this migration
   * Use case: Long operations that might lock tables for too long
   * WARNING: Only use when necessary - partial failures won't auto-rollback
   */
  disableTransaction: true,

  async up({ prisma, log }: MigrationContext) {
    log.info("Starting long-running migration (outside transaction)...");
    log.info("Timeout set to: 120 seconds");

    const posts = await prisma.post.findMany();
    const totalPosts = posts.length;

    log.info(`Processing ${totalPosts} posts individually...`);

    // Process posts one by one (simulating long operation)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      // Simulate some work (3600ms per post = ~25 seconds total)
      await new Promise(resolve => setTimeout(resolve, 3600));

      // Update the post
      await prisma.post.update({
        where: { id: post.id },
        data: {
          // Mark with a flag in content to show it was processed
          content: post.content + "\n\n[Processed by Phase 12]",
        },
      });

      if ((i + 1) % 2 === 0 || i === posts.length - 1) {
        log.info(`Progress: ${i + 1}/${totalPosts} posts processed`);
      }
    }

    log.info(`Long-running migration complete!`);
    log.info(`Note: This migration ran outside a transaction`);
  },

  /**
   * Rollback function - important when disableTransaction is true
   * Since we're outside a transaction, we need manual cleanup
   */
  async down({ prisma, log }: MigrationContext) {
    log.info("Rollback: Removing processed markers...");

    const posts = await prisma.post.findMany({
      where: {
        content: { contains: "[Processed by Phase 12]" },
      },
    });

    for (const post of posts) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: post.content.replace("\n\n[Processed by Phase 12]", ""),
        },
      });
    }

    log.info(`Cleaned up ${posts.length} posts`);
  },
};

export default migration;
