#!/usr/bin/env node

import { Command, Option } from "commander";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { MigrationRunner } from "./migration-runner";
import { loadConfig, createSampleConfig, Config } from "./config";
import { createLogger } from "./logger";
import { validateMigrations, formatValidationResult } from "./validation";
import { writeExport } from "./export";
import { squashMigrations } from "./squash";
import { 
  generateMigrationId, 
  generateMigrationTemplate, 
  ensureMigrationsDir 
} from "./utils";
import type { PrismaClient } from "@prisma/client";

// Helper to run shell commands
function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// Helper to load Prisma client dynamically
async function getPrismaClient(): Promise<PrismaClient> {
  let PrismaClientClass: any;
  
  try {
    const cwdModule = await import(path.join(process.cwd(), "node_modules/@prisma/client"));
    PrismaClientClass = cwdModule.PrismaClient;
  } catch {
    try {
      const prismaModule = await import("@prisma/client");
      PrismaClientClass = (prismaModule as any).PrismaClient;
    } catch {
      console.error("Error: @prisma/client not found. Make sure Prisma is set up.");
      process.exit(1);
    }
  }
  
  return new PrismaClientClass();
}

// Helper to load config and create runner
async function createRunner(options: any): Promise<{ runner: MigrationRunner; config: Config }> {
  const config = await loadConfig(process.cwd());
  
  // Override config with CLI options
  if (options.dir) config.migrationsDir = options.dir;
  if (options.table) config.migrationsTable = options.table;
  if (options.logLevel) config.logging = { ...config.logging, level: options.logLevel };
  if (options.noProgress) config.logging = { ...config.logging, progress: false };
  
  const prisma = await getPrismaClient();
  
  const logger = createLogger({
    level: config.logging?.level || "info",
    progress: config.logging?.progress ?? true,
  });
  
  const runner = new MigrationRunner(prisma, {
    migrationsDir: config.migrationsDir,
    migrationsTable: config.migrationsTable,
    logger,
    config,
  });
  
  return { runner, config };
}

const program = new Command();

program
  .name("prisma-shift")
  .description("CLI for managing Prisma data migrations")
  .version("0.0.3")
  .option("-d, --dir <directory>", "Migrations directory")
  .option("-t, --table <table>", "Migrations table name")
  .option("--log-level <level>", "Log level (silent, error, warn, info, debug)", "info")
  .option("--no-progress", "Disable progress indicators");

program
  .command("init")
  .description("Initialize data migrations in your project")
  .option("--config", "Create a config file", false)
  .action(async (options) => {
    const migrationsDir = program.opts().dir || "./prisma/data-migrations";
    
    ensureMigrationsDir(migrationsDir);
    
    if (options.config) {
      try {
        const configPath = createSampleConfig(process.cwd());
        console.log(`✓ Created config file: ${configPath}`);
      } catch (error) {
        console.log(`⚠ Config file already exists`);
      }
    }
    
    console.log("✓ Initialized data migrations");
    console.log(`  Directory: ${migrationsDir}`);
    console.log("");
    console.log("Next steps:");
    console.log(`  1. Add migrations: prisma-shift create <name>`);
    console.log(`  2. Run migrations: prisma-shift run`);
    console.log("");
  });

program
  .command("create")
  .description("Create a new data migration")
  .argument("<name>", "Name of the migration (e.g., 'add_user_preferences')")
  .option("-d, --dir <directory>", "Migrations directory")
  .action(async (name: string, options: { dir?: string }) => {
    const migrationsDir = options.dir || (await loadConfig()).migrationsDir;
    ensureMigrationsDir(migrationsDir);
    
    const id = generateMigrationId(name);
    const filename = `${id}.ts`;
    const filepath = path.join(migrationsDir, filename);
    
    const template = generateMigrationTemplate(id, name);
    fs.writeFileSync(filepath, template);
    
    console.log(`✓ Created migration: ${filepath}`);
    console.log(`  ID: ${id}`);
  });

program
  .command("status")
  .description("Show migration status")
  .action(async () => {
    const { runner } = await createRunner(program.opts());
    
    const status = await runner.getStatus();
    
    console.log("\n📊 Migration Status\n");
    console.log(`Migrations directory: ${(await loadConfig()).migrationsDir}`);
    console.log(`Migrations table: ${(await loadConfig()).migrationsTable}`);
    console.log("");
    
    if (status.all.length === 0) {
      console.log("No migrations found.");
    } else {
      console.log(`${"ID".padEnd(30)} ${"NAME".padEnd(30)} ${"STATUS"}`);
      console.log("-".repeat(80));
      
      for (const m of status.all) {
        const icon = m.status === "executed" ? "✓" : "○";
        const statusStr = m.status === "executed" 
          ? `executed (${m.executedAt?.toISOString().slice(0, 16)})` 
          : "pending";
        console.log(`${m.id.padEnd(30)} ${m.name.slice(0, 28).padEnd(30)} ${icon} ${statusStr}`);
      }
    }
    
    console.log("");
    console.log(`Total: ${status.executed.length} executed, ${status.pending.length} pending`);
    console.log("");
  });

program
  .command("run")
  .description("Run pending migrations")
  .option("--dry-run", "Show what would run without executing", false)
  .option("--with-schema", "Run Prisma schema migrations first, then data migrations", false)
  .option("--wait", "Wait for lock if another instance is running migrations", false)
  .action(async (options) => {
    // Run schema migrations first if requested
    if (options.withSchema) {
      console.log("📦 Running Prisma schema migrations...\n");
      try {
        await runCommand("npx", ["prisma", "migrate", "deploy"]);
        console.log("\n✓ Schema migrations complete\n");
      } catch (error) {
        console.error("\n✗ Schema migrations failed");
        process.exit(1);
      }
    }
    
    const { runner } = await createRunner(program.opts());
    
    const result = await runner.runMigrations({ dryRun: options.dryRun, waitForLock: options.wait });
    
    if (!result.success) {
      console.error(`\n✗ Migration failed at: ${result.failedMigration}`);
      if (result.error) {
        console.error(`Error: ${result.error.message}`);
      }
      process.exit(1);
    }
    
    if (options.dryRun) {
      console.log("\n[DRY RUN] No changes were made.");
    }
    
    if (result.metrics) {
      console.log(`\nTotal time: ${result.metrics.totalTime}ms`);
      console.log(`Migrations run: ${result.metrics.migrationsRun}`);
    }
  });

program
  .command("validate")
  .description("Validate migration files")
  .action(async () => {
    const config = await loadConfig();
    const prisma = await getPrismaClient();
    
    const tempRunner = new MigrationRunner(prisma, {
      migrationsDir: config.migrationsDir,
      migrationsTable: config.migrationsTable,
    });
    
    const executed = await tempRunner.getExecutedMigrations();
    const result = await validateMigrations(config.migrationsDir, executed, {
      typescript: config.typescript,
    });
    
    console.log(formatValidationResult(result));
    
    if (!result.valid) {
      process.exit(1);
    }
  });

program
  .command("rollback")
  .description("Rollback the last executed migration")
  .action(async () => {
    const { runner } = await createRunner(program.opts());
    
    const success = await runner.rollbackLast();
    process.exit(success ? 0 : 1);
  });

program
  .command("reset")
  .description("Reset all migration records (DANGER: does not rollback, just clears records)")
  .option("-f, --force", "Skip confirmation", false)
  .action(async (options) => {
    if (!options.force) {
      console.log("⚠️  This will clear all migration records but won't rollback any data changes.");
      console.log("   Use --force to skip this confirmation.");
      process.exit(1);
    }
    
    const { runner } = await createRunner(program.opts());
    await runner.reset();
  });

program
  .command("deploy")
  .description("Deploy all migrations (schema + data) in one command")
  .option("--schema <path>", "Path to Prisma schema file")
  .option("--dry-run", "Show what would run without executing", false)
  .action(async (options) => {
    try {
      console.log("🚀 Deploying all migrations...\n");

      if (options.dryRun) {
        console.log("[DRY RUN] Showing what would be executed:\n");
      }

      // Step 1: Deploy schema migrations
      console.log("📦 Step 1/3: Deploying schema migrations...");
      const schemaArgs = options.schema ? [`--schema=${options.schema}`] : [];
      await runCommand("npx", ["prisma", "migrate", "deploy", ...schemaArgs]);
      console.log("   ✓ Schema migrations complete\n");

      // Step 2: Generate Prisma Client
      console.log("🔨 Step 2/3: Generating Prisma Client...");
      await runCommand("npx", ["prisma", "generate", ...schemaArgs]);
      console.log("   ✓ Client generated\n");

      // Step 3: Run data migrations
      console.log("🔄 Step 3/3: Running data migrations...");
      const { runner } = await createRunner(program.opts());
      
      const result = await runner.runMigrations({ dryRun: options.dryRun });
      
      if (!result.success) {
        console.error(`\n   ✗ Migration failed at: ${result.failedMigration}`);
        if (result.error) {
          console.error(`   Error: ${result.error.message}`);
        }
        process.exit(1);
      }
      
      if (options.dryRun) {
        console.log("\n   [DRY RUN] No changes were made.");
      } else {
        console.log("   ✓ Data migrations complete\n");
        console.log("🎉 All migrations deployed successfully!");
      }
    } catch (error) {
      console.error("\n✗ Deployment failed:", error);
      process.exit(1);
    }
  });

program
  .command("export")
  .description("Export migration history")
  .requiredOption("-f, --format <format>", "Export format (json, csv, html)")
  .option("-o, --output <path>", "Output file path (defaults to stdout)")
  .action(async (options) => {
    const { runner } = await createRunner(program.opts());
    const executed = await runner.getExecutedMigrations();
    
    const content = writeExport(executed, {
      format: options.format,
      output: options.output,
    });
    
    if (!options.output) {
      console.log(content);
    } else {
      console.log(`✓ Exported to ${options.output}`);
    }
  });

program
  .command("squash")
  .description("Squash multiple migrations into one")
  .requiredOption("--from <id>", "Starting migration ID or date prefix")
  .requiredOption("--to <id>", "Ending migration ID or date prefix")
  .requiredOption("--name <name>", "Name for the squashed migration")
  .option("--keep", "Keep original migration files (do not delete)", false)
  .option("--dry-run", "Show what would be done without making changes", false)
  .action(async (options) => {
    try {
      const config = await loadConfig(process.cwd());
      const migrationsDir = config.migrationsDir;

      if (options.dryRun) {
        console.log("[DRY RUN] Showing what would be done:\n");
      }

      const result = await squashMigrations(
        migrationsDir,
        { from: options.from, to: options.to },
        options.name,
        { keep: options.keep, dryRun: options.dryRun }
      );

      console.log(
        `Found ${result.matchedMigrations.length} migration(s) to squash:`
      );
      for (const m of result.matchedMigrations) {
        console.log(`  - ${m.id}: ${m.name}`);
      }
      console.log("");

      if (!options.dryRun) {
        console.log(`✓ Created squashed migration: ${result.newFilePath}`);

        if (!options.keep && result.removedFiles.length > 0) {
          console.log(
            `✓ Removed ${result.removedFiles.length} original migration file(s)`
          );
        }

        // Update database records
        const { runner } = await createRunner(program.opts());
        const dbResult = await runner.squash(
          { from: options.from, to: options.to },
          result.newId,
          options.name
        );

        if (!dbResult.success) {
          console.error(`✗ Database update failed: ${dbResult.error}`);
          process.exit(1);
        }

        if (dbResult.removedRecords > 0) {
          console.log(
            `✓ Updated database records (${dbResult.removedRecords} removed, ${dbResult.addedRecord ? "1 added" : dbResult.updatedRecord ? "1 updated" : "none"})`
          );
        } else {
          console.log("  No database records to update");
        }
      } else {
        console.log(`[DRY RUN] Would create: ${result.newFilePath}`);
        if (!options.keep) {
          console.log(
            `[DRY RUN] Would remove ${result.matchedMigrations.length} original file(s)`
          );
        }
        console.log("[DRY RUN] Would update database records");
      }

      console.log("\n✓ Squash complete");
    } catch (error) {
      console.error("\n✗ Squash failed:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("config")
  .description("Manage configuration")
  .option("--init", "Create a sample config file")
  .action(async (options) => {
    if (options.init) {
      try {
        const configPath = createSampleConfig(process.cwd());
        console.log(`✓ Created config file: ${configPath}`);
      } catch (error) {
        console.error(`✗ Failed to create config: ${error}`);
        process.exit(1);
      }
    } else {
      const config = await loadConfig();
      console.log("Current configuration:\n");
      console.log(JSON.stringify(config, null, 2));
    }
  });

program.parse();
