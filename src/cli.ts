#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { MigrationRunner } from "./migration-runner";
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

const program = new Command();

program
  .name("prisma-shift")
  .description("CLI for managing Prisma data migrations")
  .version("0.1.0");

// Helper to load Prisma client dynamically
async function getPrismaClient(): Promise<PrismaClient> {
  // Try to find prisma client
  let PrismaClientClass: any;
  
  try {
    const prismaModule = await import("@prisma/client");
    PrismaClientClass = (prismaModule as any).PrismaClient;
  } catch {
    console.error("Error: @prisma/client not found. Make sure Prisma is set up.");
    process.exit(1);
  }
  
  return new PrismaClientClass();
}

// Helper to get migrations directory
function getMigrationsDir(): string {
  const envDir = process.env.DATA_MIGRATIONS_DIR;
  if (envDir) return envDir;
  
  // Check common locations
  const candidates = [
    "./prisma/data-migrations",
    "./src/data-migrations",
    "./migrations/data",
    "./data-migrations",
  ];
  
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  
  return "./prisma/data-migrations";
}

// Helper to get migrations table name
function getMigrationsTable(): string {
  return process.env.DATA_MIGRATIONS_TABLE || "_dataMigration";
}

program
  .command("init")
  .description("Initialize data migrations in your project")
  .option("-d, --dir <directory>", "Migrations directory")
  .action(async (options: { dir?: string }) => {
    const migrationsDir = options.dir || "./prisma/data-migrations";
    
    ensureMigrationsDir(migrationsDir);
    
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
    const migrationsDir = options.dir || getMigrationsDir();
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
  .option("-d, --dir <directory>", "Migrations directory")
  .option("-t, --table <table>", "Migrations table name")
  .action(async (options: { dir?: string; table?: string }) => {
    const prisma = await getPrismaClient();
    const migrationsDir = options.dir || getMigrationsDir();
    const migrationsTable = options.table || getMigrationsTable();
    
    try {
      const runner = new MigrationRunner(prisma, {
        migrationsDir,
        migrationsTable,
      });
      
      const status = await runner.getStatus();
      
      console.log("\n📊 Migration Status\n");
      console.log(`Migrations directory: ${migrationsDir}`);
      console.log(`Migrations table: ${migrationsTable}`);
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
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command("run")
  .description("Run pending migrations")
  .option("-d, --dir <directory>", "Migrations directory")
  .option("-t, --table <table>", "Migrations table name")
  .action(async (options: { dir?: string; table?: string }) => {
    const prisma = await getPrismaClient();
    const migrationsDir = options.dir || getMigrationsDir();
    const migrationsTable = options.table || getMigrationsTable();
    
    try {
      const runner = new MigrationRunner(prisma, {
        migrationsDir,
        migrationsTable,
      });
      
      const result = await runner.runMigrations();
      
      if (!result.success) {
        console.error(`\n✗ Migration failed at: ${result.failedMigration}`);
        if (result.error) {
          console.error(`Error: ${result.error.message}`);
        }
        process.exit(1);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command("rollback")
  .description("Rollback the last executed migration")
  .option("-d, --dir <directory>", "Migrations directory")
  .option("-t, --table <table>", "Migrations table name")
  .action(async (options: { dir?: string; table?: string }) => {
    const prisma = await getPrismaClient();
    const migrationsDir = options.dir || getMigrationsDir();
    const migrationsTable = options.table || getMigrationsTable();
    
    try {
      const runner = new MigrationRunner(prisma, {
        migrationsDir,
        migrationsTable,
      });
      
      const success = await runner.rollbackLast();
      process.exit(success ? 0 : 1);
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command("reset")
  .description("Reset all migration records (DANGER: does not rollback, just clears records)")
  .option("-t, --table <table>", "Migrations table name")
  .action(async (options: { table?: string }) => {
    const prisma = await getPrismaClient();
    const migrationsTable = options.table || getMigrationsTable();
    
    console.log("⚠️  This will clear all migration records but won't rollback any data changes.");
    console.log("   Make sure you know what you're doing!\n");
    
    try {
      const runner = new MigrationRunner(prisma, {
        migrationsDir: getMigrationsDir(),
        migrationsTable,
      });
      
      await runner.reset();
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command("deploy")
  .description("Deploy all migrations (schema + data) in one command")
  .option("-d, --dir <directory>", "Data migrations directory")
  .option("-t, --table <table>", "Migrations table name")
  .option("--schema <path>", "Path to Prisma schema file")
  .action(async (options: { dir?: string; table?: string; schema?: string }) => {
    try {
      console.log("🚀 Deploying all migrations...\n");

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
      const prisma = await getPrismaClient();
      const migrationsDir = options.dir || getMigrationsDir();
      const migrationsTable = options.table || getMigrationsTable();
      
      try {
        const runner = new MigrationRunner(prisma, {
          migrationsDir,
          migrationsTable,
        });
        
        const result = await runner.runMigrations();
        
        if (!result.success) {
          console.error(`\n   ✗ Migration failed at: ${result.failedMigration}`);
          if (result.error) {
            console.error(`   Error: ${result.error.message}`);
          }
          process.exit(1);
        }
        
        console.log("   ✓ Data migrations complete\n");
        console.log("🎉 All migrations deployed successfully!");
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      console.error("\n✗ Deployment failed:", error);
      process.exit(1);
    }
  });

program.parse();
