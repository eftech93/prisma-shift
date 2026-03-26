/**
 * PHASE 2.3: Setup Categories and Assign Existing Posts
 * 
 * This migration runs AFTER adding the Category table and categoryId to Post.
 * It creates categories from JSON and assigns existing posts to a default category.
 * 
 * Migration Sequence:
 * 2.1 Schema: Create Category table, add categoryId to Post
 * 2.2 Generate: prisma generate
 * 2.3 Data: This migration - Setup categories ← YOU ARE HERE
 */

import * as fs from "fs";
import * as path from "path";
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010002_setup_categories",
  name: "setup_categories",
  createdAt: 1711238402000, // 2024-03-24T00:00:02Z

  async up({ prisma, log }: MigrationContext) {
    const dataDir = path.join(process.cwd(), "data");

    // Load categories from JSON
    log("Loading categories from categories.json...");
    const categoriesData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "categories.json"), "utf8")
    );

    // Create categories (skip if already exist via upsert)
    for (const catData of categoriesData) {
      await prisma.category.upsert({
        where: { name: catData.name },
        create: {
          name: catData.name,
          description: catData.description,
          color: catData.color,
        },
        update: {}, // No update needed
      });
    }
    log(`Created ${categoriesData.length} categories`);

    // Get the "General" category for default assignment
    const generalCategory = await prisma.category.findUnique({
      where: { name: "General" },
    });

    if (!generalCategory) {
      throw new Error("General category not found");
    }

    // Assign all uncategorized posts to "General"
    log("Assigning existing posts to General category...");
    const result = await prisma.post.updateMany({
      where: { categoryId: null },
      data: { categoryId: generalCategory.id },
    });
    log(`Assigned ${result.count} posts to General category`);

    // Assign specific posts to relevant categories based on content
    log("Assigning posts to relevant categories...");
    
    // Assign TypeScript post to Programming
    const programmingCat = await prisma.category.findUnique({
      where: { name: "Programming" },
    });
    if (programmingCat) {
      await prisma.post.updateMany({
        where: {
          title: { contains: "TypeScript", mode: "insensitive" },
        },
        data: { categoryId: programmingCat.id },
      });
      log("Assigned TypeScript posts to Programming");
    }

    // Assign Prisma post to Database
    const databaseCat = await prisma.category.findUnique({
      where: { name: "Database" },
    });
    if (databaseCat) {
      await prisma.post.updateMany({
        where: {
          OR: [
            { title: { contains: "Prisma", mode: "insensitive" } },
            { title: { contains: "Database", mode: "insensitive" } },
          ],
        },
        data: { categoryId: databaseCat.id },
      });
      log("Assigned Database/Prisma posts to Database category");
    }

    log("Category setup complete!");
  },

  async down({ prisma, log }: MigrationContext) {
    // Remove category assignments first
    log("Removing category assignments...");
    await prisma.post.updateMany({
      data: { categoryId: null },
    });

    // Delete categories
    log("Deleting categories...");
    await prisma.category.deleteMany({});

    log("Categories removed");
  },
};

export default migration;
