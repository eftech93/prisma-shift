/**
 * Unified Demo Application
 * 
 * This demonstrates using the Prisma client with data migration extension
 * to query the fully migrated blog database.
 */

import { PrismaClient } from "@prisma/client";
import { withDataMigrations } from "prisma-shift";

// Create extended Prisma client
const basePrisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

const prisma = withDataMigrations(basePrisma, {
  migrationsDir: "./prisma/data-migrations",
});

async function main() {
  console.log("🚀 Unified Demo: Blog Platform\n");
  console.log("================================\n");

  // Check migration status
  console.log("📊 Migration Status:");
  const status = await prisma.$dataMigrations.status();
  console.log(`   Executed: ${status.executed.length}`);
  console.log(`   Pending:  ${status.pending.length}`);
  
  if (status.pending.length > 0) {
    console.log("\n⚠️  Running pending migrations...");
    await prisma.$dataMigrations.run();
  }
  console.log("✅ All migrations up to date\n");

  // Demo queries
  console.log("📋 Platform Overview:\n");

  // 1. Users with profiles
  console.log("👥 Users:");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      postCount: true,
      _count: { select: { posts: true } },
    },
  });
  
  for (const user of users) {
    console.log(`   ${user.name || user.email} (${user.role})`);
    console.log(`     Posts: ${user.postCount} (verified: ${user._count.posts})`);
    console.log(`     Avatar: ${user.avatar ? "✓" : "✗"}`);
  }
  console.log();

  // 2. Categories
  console.log("📁 Categories:");
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { posts: true } },
    },
  });
  
  for (const cat of categories) {
    console.log(`   ${cat.name}: ${cat._count.posts} posts (${cat.color})`);
  }
  console.log();

  // 3. Posts with all features
  console.log("📝 Posts (with all generated fields):");
  const posts = await prisma.post.findMany({
    where: { deletedAt: null }, // Exclude soft-deleted
    include: {
      author: { select: { name: true, email: true } },
      category: true,
      tags: { include: { tag: true } },
      stats: true,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const post of posts) {
    console.log(`\n   📄 ${post.title}`);
    console.log(`      Slug: ${post.slug}`);
    console.log(`      Author: ${post.author?.name || post.author?.email}`);
    console.log(`      Category: ${post.category?.name}`);
    console.log(`      State: ${post.state}${post.publishedAt ? ` (published: ${post.publishedAt.toISOString().split("T")[0]})` : ""}`);
    console.log(`      Reading Time: ${post.readingTime} min`);
    console.log(`      Excerpt: ${post.excerpt?.slice(0, 80)}...`);
    console.log(`      Tags: ${post.tags.map((t) => t.tag.name).join(", ") || "none"}`);
    console.log(`      Stats: ${post.stats?.viewCount || 0} views`);
  }
  console.log();

  // 4. Tags
  console.log("🏷️  Tags:");
  const tags = await prisma.tag.findMany({
    include: {
      _count: { select: { posts: true } },
    },
  });
  
  for (const tag of tags) {
    console.log(`   ${tag.displayName} (${tag.name}): ${tag._count.posts} posts`);
  }
  console.log();

  // 5. Statistics
  console.log("📈 Statistics:");
  const totalPosts = await prisma.post.count({ where: { deletedAt: null } });
  const publishedPosts = await prisma.post.count({
    where: { state: "PUBLISHED", deletedAt: null },
  });
  const draftPosts = await prisma.post.count({
    where: { state: "DRAFT", deletedAt: null },
  });
  const totalViews = await prisma.postStats.aggregate({
    _sum: { viewCount: true },
  });

  console.log(`   Total Posts: ${totalPosts}`);
  console.log(`   Published: ${publishedPosts}`);
  console.log(`   Drafts: ${draftPosts}`);
  console.log(`   Total Views: ${totalViews._sum.viewCount || 0}`);
  console.log();

  // 6. Show soft-deleted posts (if any)
  const deletedPosts = await prisma.post.findMany({
    where: { deletedAt: { not: null } },
    select: { title: true, deletedAt: true },
  });
  
  if (deletedPosts.length > 0) {
    console.log("🗑️  Soft-Deleted Posts:");
    for (const post of deletedPosts) {
      console.log(`   ${post.title} (deleted: ${post.deletedAt?.toISOString().split("T")[0]})`);
    }
  }

  console.log("\n✨ Demo complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
