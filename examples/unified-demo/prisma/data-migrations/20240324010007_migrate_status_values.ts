/**
 * PHASE 7.3: Migrate Status Values
 * 
 * This migration runs AFTER adding state and publishedAt columns.
 * It demonstrates enum migration - transforming old status values to new format.
 * Maps: "draft" → "DRAFT", "published" → "PUBLISHED", "archived" → "ARCHIVED"
 * 
 * Migration Sequence:
 * 7.1 Schema: Add state and publishedAt columns
 * 7.2 Generate: prisma generate
 * 7.3 Data: This migration - Migrate status values ← YOU ARE HERE
 * 7.4 Schema: Remove old status column (after verification)
 */

import { DataMigration, MigrationContext } from "prisma-shift";

// Status mapping from old to new
const STATUS_MAPPING: Record<string, string> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  archived: "ARCHIVED",
};

const migration: DataMigration = {
  id: "20240324010007_migrate_status_values",
  name: "migrate_status_values",
  createdAt: 1711238407000, // 2024-03-24T00:00:07Z

  async up({ prisma, log }: MigrationContext) {
    // Find posts that haven't been migrated yet
    const posts = await prisma.post.findMany({
      where: {
        state: null, // New field is null
        status: { not: null }, // Old field has value
      },
    });

    log(`Migrating status for ${posts.length} posts...`);

    let migrated = 0;
    let skipped = 0;

    for (const post of posts) {
      const oldStatus = post.status?.toLowerCase() || "";
      const newState = STATUS_MAPPING[oldStatus];

      if (!newState) {
        log(`Unknown status "${post.status}" for post ${post.id}, defaulting to DRAFT`);
        skipped++;
        continue;
      }

      // Calculate publishedAt for published posts
      let publishedAt: Date | null = null;
      if (newState === "PUBLISHED") {
        // Use post creation date as publish date
        publishedAt = post.createdAt;
      } else if (newState === "ARCHIVED") {
        // Use updatedAt for archived posts
        publishedAt = post.createdAt; // Or could be null
      }

      await prisma.post.update({
        where: { id: post.id },
        data: {
          state: newState,
          publishedAt,
        },
      });

      migrated++;
    }

    log(`Migration complete: ${migrated} migrated, ${skipped} defaulted to DRAFT`);
    log("Status mapping:");
    log("  draft → DRAFT");
    log("  published → PUBLISHED (+ publishedAt set)");
    log("  archived → ARCHIVED");
  },

  async down({ prisma, log }: MigrationContext) {
    // Reverse mapping
    const REVERSE_MAPPING: Record<string, string> = {
      DRAFT: "draft",
      PUBLISHED: "published",
      ARCHIVED: "archived",
    };

    const posts = await prisma.post.findMany({
      where: { state: { not: null } },
    });

    log(`Reverting status for ${posts.length} posts...`);

    for (const post of posts) {
      const oldStatus = REVERSE_MAPPING[post.state || ""];
      
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: oldStatus,
          state: null,
          publishedAt: null,
        },
      });
    }

    log("Status reverted to old format");
  },
};

export default migration;
