/**
 * PHASE 4.4: Import Tags and Link to Posts
 * 
 * This migration runs AFTER creating Tag and PostTag tables.
 * It demonstrates many-to-many relationship setup.
 * Loads tags from JSON and intelligently links them to posts.
 * 
 * Migration Sequence:
 * 4.1 Schema: Create Tag table
 * 4.2 Schema: Create PostTag join table
 * 4.3 Generate: prisma generate
 * 4.4 Data: This migration - Import tags ← YOU ARE HERE
 */

import * as fs from "fs";
import * as path from "path";
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010004_import_tags",
  name: "import_tags",
  createdAt: 1711238404000, // 2024-03-24T00:00:04Z

  async up({ prisma, log }: MigrationContext) {
    const dataDir = path.join(process.cwd(), "data");

    // Load tags from JSON
    log.info("Loading tags from tags.json...");
    const tagsData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "tags.json"), "utf8")
    );

    // Create tags
    for (const tagData of tagsData) {
      await prisma.tag.upsert({
        where: { name: tagData.name },
        create: {
          name: tagData.name,
          displayName: tagData.displayName,
        },
        update: {},
      });
    }
    log.info(`Created ${tagsData.length} tags`);

    // Get all posts and tags for linking
    const posts = await prisma.post.findMany();
    const tags = await prisma.tag.findMany();
    const tagMap = new Map(tags.map((t: { name: string; id: string }) => [t.name, t.id]));

    log.info("Linking tags to posts based on content...");
    let linkCount = 0;

    for (const post of posts) {
      const titleLower = post.title.toLowerCase();
      const contentLower = (post.content || "").toLowerCase();
      const tagsToLink: string[] = [];

      // Smart tag matching based on content
      if (titleLower.includes("typescript") || contentLower.includes("typescript")) {
        tagsToLink.push("typescript");
      }
      if (titleLower.includes("javascript") || contentLower.includes("javascript")) {
        tagsToLink.push("javascript");
      }
      if (titleLower.includes("prisma") || contentLower.includes("prisma")) {
        tagsToLink.push("prisma");
      }
      if (titleLower.includes("react") || contentLower.includes("react")) {
        tagsToLink.push("react");
      }
      if (titleLower.includes("database") || contentLower.includes("database")) {
        tagsToLink.push("database");
      }
      if (titleLower.includes("tutorial") || titleLower.includes("getting started")) {
        tagsToLink.push("tutorial");
        tagsToLink.push("beginners");
      }
      if (titleLower.includes("advanced") || titleLower.includes("patterns")) {
        tagsToLink.push("advanced");
      }
      if (titleLower.includes("best practice") || titleLower.includes("design")) {
        tagsToLink.push("best-practices");
      }

      // Link tags to post
      for (const tagName of tagsToLink) {
        const tagId = tagMap.get(tagName);
        if (tagId) {
          try {
            await prisma.postTag.create({
              data: {
                postId: post.id,
                tagId: tagId,
              },
            });
            linkCount++;
          } catch (e) {
            // Ignore duplicate link errors
          }
        }
      }
    }

    log.info(`Linked ${linkCount} tags to posts`);
    log.info("Tag import complete!");
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Removing tag links...");
    await prisma.postTag.deleteMany({});

    log.info("Removing tags...");
    await prisma.tag.deleteMany({});

    log.info("Tags removed");
  },
};

export default migration;
