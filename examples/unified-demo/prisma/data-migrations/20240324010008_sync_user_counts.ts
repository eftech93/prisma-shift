/**
 * PHASE 8.1: Sync User Post Counts
 * 
 * This migration aggregates post counts per user and syncs them to the User table.
 * It demonstrates multi-table synchronization.
 * 
 * Migration Sequence:
 * 8.1 Data: This migration - Sync counts ← YOU ARE HERE
 * 8.2 Data: Cleanup orphaned records (optional)
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010008_sync_user_counts",
  name: "sync_user_counts",
  createdAt: 1711238408000, // 2024-03-24T00:00:08Z

  async up({ prisma, log }: MigrationContext) {
    // Get all users with their post counts
    log.info("Calculating post counts per user...");
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        _count: {
          select: {
            posts: {
              where: {
                deletedAt: null, // Don't count soft-deleted posts
              },
            },
          },
        },
      },
    });

    log.info(`Syncing post counts for ${users.length} users...`);

    let synced = 0;
    for (const user of users) {
      const actualCount = user._count.posts;
      
      // Get current stored count
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { postCount: true },
      });

      // Only update if different (avoid unnecessary writes)
      if (currentUser && currentUser.postCount !== actualCount) {
        await prisma.user.update({
          where: { id: user.id },
          data: { postCount: actualCount },
        });
        synced++;
      }
    }

    log.info(`Synced ${synced} users (out of ${users.length})`);
    
    // Show summary
    const stats = await prisma.user.groupBy({
      by: ["role"],
      _sum: { postCount: true },
      _count: { id: true },
    });

    log.info("\nPost count summary by role:");
    for (const stat of stats) {
      const total = stat._sum.postCount || 0;
      const users = stat._count.id;
      const avg = users > 0 ? (total / users).toFixed(1) : "0";
      log.info(`  ${stat.role}: ${total} posts across ${users} users (avg ${avg}/user)`);
    }

    // Find users with mismatched counts (data quality check)
    log.info("\nChecking for data inconsistencies...");
    const allUsers = await prisma.user.findMany({
      include: {
        _count: { select: { posts: true } },
      },
    });

    let inconsistencies = 0;
    for (const user of allUsers) {
      if (user.postCount !== user._count.posts) {
        inconsistencies++;
        log.info(`  WARNING: User ${user.id} has ${user.postCount} count but ${user._count.posts} posts`);
      }
    }

    if (inconsistencies === 0) {
      log.info("  ✓ All counts are consistent");
    } else {
      log.info(`  ⚠ Found ${inconsistencies} inconsistencies`);
    }
  },

  async down({ log }: MigrationContext) {
    log.info("Note: User counts will be recalculated on next sync");
    log.info("To reset: Run a migration to set all postCount to 0");
  },
};

export default migration;
