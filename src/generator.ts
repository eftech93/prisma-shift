#!/usr/bin/env node

/**
 * Prisma Generator for Data Migrations
 * 
 * This generator automatically runs data migrations after schema migrations.
 * Add this to your schema.prisma:
 * 
 * generator dataMigration {
 *   provider = "prisma-shift-generator"
 *   migrationsDir = "./prisma/data-migrations"  // optional
 * }
 */

import { generatorHandler } from "@prisma/generator-helper";
import { MigrationRunner } from "./migration-runner";
import { PrismaClient } from "@prisma/client";

// Get migrations directory from generator config or environment
function getMigrationsDir(config: any): string {
  return config.migrationsDir || 
         process.env.DATA_MIGRATIONS_DIR || 
         "./prisma/data-migrations";
}

// Get migrations table from generator config or environment
function getMigrationsTable(config: any): string {
  return config.migrationsTable || 
         process.env.DATA_MIGRATIONS_TABLE || 
         "_dataMigration";
}

// Check if we should run migrations (to avoid running during generate only)
function shouldRunMigrations(): boolean {
  // Only run after migrate deploy, not during regular generate
  // Check if this is being run in the context of a migration
  const args = process.argv;
  const env = process.env;
  
  // Don't run during regular `prisma generate`
  // The generator runs during both `prisma generate` and `prisma migrate deploy`
  // We want to run data migrations only after schema migrations
  
  // Check if MIGRATE_DEPLOY is set (we'll set this in our wrapper)
  if (env.PRISMA_DATA_MIGRATION_AUTO_RUN === "true") {
    return true;
  }
  
  // By default, don't auto-run to avoid running during regular generate
  return false;
}

generatorHandler({
  onManifest: () => ({
    defaultOutput: "../data-migrations", // Not used, but required
    prettyName: "Prisma Shift Generator",
    requiresGenerators: ["prisma-client-js"],
  }),
  onGenerate: async (options) => {
    console.log("\n🔄 Prisma Data Migration Generator\n");
    
    // Check if we should auto-run
    if (!shouldRunMigrations()) {
      console.log("ℹ️  Skipping data migrations (run manually with: npx prisma-shift deploy)");
      console.log("   Or set PRISMA_DATA_MIGRATION_AUTO_RUN=true to enable auto-run\n");
      return;
    }
    
    const migrationsDir = getMigrationsDir(options.generator.config);
    const migrationsTable = getMigrationsTable(options.generator.config);
    
    console.log(`📁 Migrations directory: ${migrationsDir}`);
    console.log(`📋 Migrations table: ${migrationsTable}\n`);
    
    try {
      // Create Prisma Client
      const prisma = new PrismaClient();
      
      try {
        const runner = new MigrationRunner(prisma, {
          migrationsDir,
          migrationsTable,
        });
        
        console.log("🚀 Running data migrations...\n");
        const result = await runner.runMigrations();
        
        if (!result.success) {
          console.error(`\n✗ Migration failed at: ${result.failedMigration}`);
          if (result.error) {
            console.error(`Error: ${result.error.message}`);
          }
          throw new Error("Data migration failed");
        }
        
        console.log("\n✅ Data migrations complete!\n");
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      console.error("\n✗ Data migration error:", error);
      throw error;
    }
  },
});
