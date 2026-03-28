/**
 * PHASE 5.3: Generate Content Fields
 * 
 * This migration runs AFTER adding slug, excerpt, and readingTime columns.
 * It demonstrates computed field generation.
 * 
 * Migration Sequence:
 * 5.1 Schema: Add slug, excerpt, readingTime columns
 * 5.2 Generate: prisma generate
 * 5.3 Data: This migration - Generate content fields ← YOU ARE HERE
 */

import { DataMigration, MigrationContext } from "prisma-shift";

// Generate URL-friendly slug from title
function generateSlug(title: string, id: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, ""); // Remove leading/trailing hyphens
  
  // Add unique suffix from post ID
  return `${baseSlug}-${id.slice(-8)}`;
}

// Generate excerpt from content
function generateExcerpt(content: string | null, maxLength: number = 150): string {
  if (!content) return "";
  
  // Remove extra whitespace and truncate
  const cleaned = content.replace(/\s+/g, " ").trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.slice(0, lastSpace) + "...";
}

// Calculate reading time in minutes (average 200 words per minute)
function calculateReadingTime(content: string | null): number {
  if (!content) return 1;
  
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200);
  return Math.max(1, minutes); // Minimum 1 minute
}

const migration: DataMigration = {
  id: "20240324010005_generate_content_fields",
  name: "generate_content_fields",
  createdAt: 1711238405000, // 2024-03-24T00:00:05Z

  async up({ prisma, log }: MigrationContext) {
    // Find posts that need content fields generated
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { slug: null },
          { excerpt: null },
          { readingTime: null },
        ],
      },
    });

    log.info(`Generating content fields for ${posts.length} posts...`);
    let generatedCount = 0;

    for (const post of posts) {
      const slug = generateSlug(post.title, post.id);
      const excerpt = generateExcerpt(post.content);
      const readingTime = calculateReadingTime(post.content);

      try {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            slug,
            excerpt,
            readingTime,
          },
        });
        generatedCount++;
      } catch (error: any) {
        // Handle potential slug collision
        if (error.code === "P2002") {
          log.info(`Slug collision for "${post.title}", using fallback`);
          await prisma.post.update({
            where: { id: post.id },
            data: {
              slug: `${slug}-${Date.now()}`,
              excerpt,
              readingTime,
            },
          });
          generatedCount++;
        } else {
          throw error;
        }
      }
    }

    log.info(`Generated content fields for ${generatedCount} posts`);
    log.info("  - slugs: URL-friendly identifiers");
    log.info("  - excerpts: Short previews");
    log.info("  - readingTime: Estimated minutes");
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Clearing generated content fields...");
    
    await prisma.post.updateMany({
      data: {
        slug: null,
        excerpt: null,
        readingTime: null,
      },
    });

    log.info("Content fields cleared");
  },
};

export default migration;
