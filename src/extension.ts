import { Prisma } from "@prisma/client";
import { MigrationRunner } from "./migration-runner";
import { MigrationOptions, MigrationStatus, MigrationResult } from "./types";
import type { PrismaClient } from "@prisma/client";

// Extension result type
export type WithDataMigrations<T> = T & {
  $dataMigrations: {
    run: () => Promise<MigrationResult>;
    status: () => Promise<MigrationStatus>;
    rollback: () => Promise<boolean>;
    reset: () => Promise<void>;
  };
};

/**
 * Create a Prisma client extension for data migrations
 */
export function createMigrationExtension(options: MigrationOptions) {
  return Prisma.defineExtension((client) => {
    const runner = new MigrationRunner(
      client as any,
      options
    );

    return client.$extends({
      model: {},
      query: {},
      client: {
        $dataMigrations: {
          run: async () => {
            return runner.runMigrations();
          },
          status: async () => {
            return runner.getStatus();
          },
          rollback: async () => {
            return runner.rollbackLast();
          },
          reset: async () => {
            return runner.reset();
          },
        },
      },
    });
  });
}

/**
 * Apply the migration extension to a Prisma client
 * 
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client";
 * import { withDataMigrations } from "prisma-shift";
 * 
 * const prisma = withDataMigrations(new PrismaClient(), {
 *   migrationsDir: "./prisma/data-migrations"
 * });
 * 
 * // Now you can use:
 * // await prisma.$dataMigrations.run();
 * // await prisma.$dataMigrations.status();
 * ```
 */
export function withDataMigrations<T extends PrismaClient>(
  prisma: T,
  options: MigrationOptions
): WithDataMigrations<T> {
  const extension = createMigrationExtension(options);
  return (prisma as any).$extends(extension) as WithDataMigrations<T>;
}

/**
 * Create a new Prisma client with data migrations enabled
 * 
 * @example
 * ```typescript
 * import { createPrismaClientWithMigrations } from "prisma-shift";
 * 
 * const prisma = createPrismaClientWithMigrations({
 *   migrationsDir: "./prisma/data-migrations"
 * });
 * ```
 */
export function createPrismaClientWithMigrations(
  options: MigrationOptions & { prismaClientOptions?: any }
): WithDataMigrations<PrismaClient> {
  const { PrismaClient } = require("@prisma/client");
  const { migrationsDir, migrationsTable, schemaPath, autoRun, prismaClientOptions } = options;
  
  const baseClient = new PrismaClient(prismaClientOptions);
  
  const client = withDataMigrations(baseClient, {
    migrationsDir,
    migrationsTable,
    schemaPath,
    autoRun,
  });

  // Auto-run migrations if configured
  if (autoRun) {
    // Use setImmediate to not block initialization
    setImmediate(async () => {
      try {
        await (client as any).$connect();
        await (client as any).$dataMigrations.run();
      } catch (error) {
        console.error("Auto-run migrations failed:", error);
      }
    });
  }

  return client as any;
}
