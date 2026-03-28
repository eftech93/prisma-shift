/**
 * PHASE 1.3: Load Seed Data from JSON
 * 
 * This migration demonstrates loading initial data from JSON files.
 * It runs AFTER the initial schema migration creates the User and Post tables.
 * 
 * Migration Sequence:
 * 1.1 Schema: Create User and Post tables
 * 1.2 Generate: prisma generate
 * 1.3 Data: This migration - Load seed data ← YOU ARE HERE
 */

import * as fs from "fs";
import * as path from "path";
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010001_load_seed_data",
  name: "load_seed_data",
  createdAt: 1711238401000, // 2024-03-24T00:00:01Z

  async up({ prisma, log }: MigrationContext) {
    const dataDir = path.join(process.cwd(), "data");

    // Check if we already have data (idempotency check)
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      log.info("Seed data already loaded, skipping");
      return;
    }

    // Load users from JSON
    log.info("Loading users from seed-users.json...");
    const usersData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "seed-users.json"), "utf8")
    );

    for (const userData of usersData) {
      await prisma.user.create({
        data: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          createdAt: new Date(userData.createdAt),
        },
      });
    }
    log.info(`Created ${usersData.length} users`);

    // Load posts from JSON
    log.info("Loading posts from seed-posts.json...");
    const postsData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "seed-posts.json"), "utf8")
    );

    for (const postData of postsData) {
      await prisma.post.create({
        data: {
          id: postData.id,
          title: postData.title,
          content: postData.content,
          state: postData.state || postData.status?.toUpperCase() || "DRAFT",
          publishedAt: postData.status === "published" ? new Date(postData.createdAt) : null,
          authorId: postData.authorId,
          createdAt: new Date(postData.createdAt),
          viewCount: postData.viewCount || 0,
        },
      });
    }
    log.info(`Created ${postsData.length} posts`);

    log.info("Seed data loaded successfully!");
  },

  async down({ prisma, log }: MigrationContext) {
    // Delete in reverse order (posts first due to foreign key)
    log.info("Removing seed posts...");
    await prisma.post.deleteMany({});

    log.info("Removing seed users...");
    await prisma.user.deleteMany({});

    log.info("Seed data removed");
  },
};

export default migration;
