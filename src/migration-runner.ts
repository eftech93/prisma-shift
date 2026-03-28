import {
  DataMigration,
  MigrationRecord,
  MigrationOptions,
  MigrationStatus,
  MigrationResult,
  MigrationContext,
  PrismaClientLike,
  MigrationMetrics,
} from "./types";
import { loadMigrations } from "./utils";
import { Logger, createLogger, createSilentLogger } from "./logger";
import { createLock, Lock, LockConfig } from "./lock";
import { HookManager, HooksConfig } from "./hooks";
import { batchProcess, createProgressTracker } from "./batch";
import { Config, defaultConfig } from "./config";

export interface EnhancedMigrationOptions extends MigrationOptions {
  /** Configuration object (alternative to individual options) */
  config?: Config;
}

export class MigrationRunner {
  private prisma: PrismaClientLike;
  private options: MigrationOptions & { migrationsDir: string; migrationsTable: string };
  private config: Config;
  private logger: Logger;
  private lock: Lock;
  private hooks: HookManager;

  constructor(prisma: PrismaClientLike, options: EnhancedMigrationOptions) {
    this.prisma = prisma;
    
    // Merge config with individual options
    this.config = {
      ...defaultConfig,
      ...options.config,
    };
    
    this.options = {
      migrationsDir: this.config.migrationsDir,
      migrationsTable: this.config.migrationsTable,
      schemaPath: options.schemaPath || this.config.schemaPath || "./prisma/schema.prisma",
      autoRun: options.autoRun ?? false,
      logger: options.logger!,
      lock: options.lock || this.config.lock || defaultConfig.lock!,
      execution: options.execution || this.config.execution || defaultConfig.execution!,
      hooks: options.hooks || this.config.hooks,
    };

    // Initialize logger
    this.logger = this.options.logger || createLogger({
      level: this.config.logging?.level || "info",
      progress: this.config.logging?.progress ?? true,
    });

    // Initialize lock
    const lockConfig: LockConfig = {
      enabled: this.options.lock?.enabled ?? false,
      timeout: this.options.lock?.timeout ?? 30000,
      retryAttempts: this.options.lock?.retryAttempts ?? 3,
      retryDelay: this.options.lock?.retryDelay ?? 1000,
    };
    this.lock = createLock(prisma, "prisma-shift-migration-lock", lockConfig);

    // Initialize hooks
    this.hooks = new HookManager(this.options.hooks || {}, process.cwd());
  }

  /**
   * Ensure the migrations table exists
   */
  async ensureMigrationsTable(): Promise<void> {
    const tableName = this.options.migrationsTable;
    
    try {
      await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM "${tableName}" LIMIT 1`
      );
    } catch {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE "${tableName}" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL,
          "executedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "duration" INTEGER NOT NULL
        )
      `);
      this.logger.debug(`Created migrations table: ${tableName}`);
    }
  }

  /**
   * Get all executed migrations from the database
   */
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureMigrationsTable();
    const tableName = this.options.migrationsTable;
    
    const results = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "name", "createdAt", "executedAt", "duration" FROM "${tableName}" ORDER BY "executedAt" ASC`
    ) as MigrationRecord[];
    
    return results || [];
  }

  /**
   * Get the current migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const [allMigrations, executedRecords] = await Promise.all([
      loadMigrations(this.options.migrationsDir, this.config.typescript),
      this.getExecutedMigrations(),
    ]);

    const executedIds = new Set(executedRecords.map((r) => r.id));
    const pending = allMigrations.filter((m) => !executedIds.has(m.id));
    const executed = executedRecords;

    const all = allMigrations.map((m) => {
      const record = executedRecords.find((r) => r.id === m.id);
      const status: "pending" | "executed" = record ? "executed" : "pending";
      return {
        ...m,
        status,
        executedAt: record?.executedAt,
        duration: record?.duration,
      };
    });

    return { pending, executed, all };
  }

  /**
   * Record a migration as executed
   */
  private async recordMigration(
    migration: DataMigration,
    duration: number
  ): Promise<void> {
    const tableName = this.options.migrationsTable;
    const createdAt = new Date(migration.createdAt);
    
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${tableName}" ("id", "name", "createdAt", "executedAt", "duration") 
       VALUES ($1, $2, $3::timestamp, CURRENT_TIMESTAMP, $4)`,
      migration.id,
      migration.name,
      createdAt.toISOString(),
      duration
    );
  }

  /**
   * Create migration context with utilities
   */
  private createContext(signal?: AbortSignal): MigrationContext {
    // Create a callable logger function that also has Logger methods
    // This supports both: log("message") and log.info("message")
    const contextLogger = Object.assign(
      (msg: string) => this.logger.info(msg),
      {
        error: (msg: string, meta?: Record<string, unknown>) => this.logger.error(msg, meta),
        warn: (msg: string, meta?: Record<string, unknown>) => this.logger.warn(msg, meta),
        info: (msg: string, meta?: Record<string, unknown>) => this.logger.info(msg, meta),
        debug: (msg: string, meta?: Record<string, unknown>) => this.logger.debug(msg, meta),
        migrationStart: (id: string, name: string) => this.logger.migrationStart(id, name),
        migrationEnd: (id: string, name: string, duration: number, success: boolean) => 
          this.logger.migrationEnd(id, name, duration, success),
        migrationError: (id: string, error: Error) => this.logger.migrationError(id, error),
        batchProgress: (current: number, total: number, message?: string) => 
          this.logger.batchProgress(current, total, message),
        lockAcquired: (timeout: number) => this.logger.lockAcquired(timeout),
        lockReleased: () => this.logger.lockReleased(),
        lockRetry: (attempt: number, maxAttempts: number) => this.logger.lockRetry(attempt, maxAttempts),
        hookStart: (name: string, type: string) => this.logger.hookStart(name, type),
        hookEnd: (name: string, type: string, duration: number) => this.logger.hookEnd(name, type, duration),
        hookError: (name: string, type: string, error: Error) => this.logger.hookError(name, type, error),
      }
    );

    return {
      prisma: this.prisma as any,
      log: contextLogger,
      batch: async <T>(options: import("./batch").BatchOptions<T>) => {
        return batchProcess(options, this.logger);
      },
      progress: (total: number) => createProgressTracker(total, this.logger),
      signal,
    };
  }

  /**
   * Check migration dependencies
   */
  private async checkDependencies(
    migration: DataMigration,
    executedIds: Set<string>
  ): Promise<{ ok: boolean; missing: string[] }> {
    const missing: string[] = [];

    if (migration.requiresData) {
      for (const depId of migration.requiresData) {
        if (!executedIds.has(depId)) {
          missing.push(depId);
        }
      }
    }

    return { ok: missing.length === 0, missing };
  }

  /**
   * Check migration condition
   */
  private async checkCondition(migration: DataMigration): Promise<boolean> {
    if (!migration.condition) {
      return true;
    }

    const context = this.createContext();
    return migration.condition({ prisma: context.prisma, log: context.log });
  }

  /**
   * Execute a single migration with timeout
   */
  private async executeMigration(
    migration: DataMigration,
    dryRun: boolean = false
  ): Promise<void> {
    const startTime = Date.now();
    const timeout = migration.timeout || this.options.execution?.timeout || 0;

    this.logger.migrationStart(migration.id, migration.name);

    // Create abort controller for timeout
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error(`Migration timeout after ${timeout}ms`));
      }, timeout);
    }

    try {
      const context = this.createContext(abortController.signal);

      // Run beforeEach hook
      await this.hooks.runBeforeEach(this.prisma, this.logger, {
        id: migration.id,
        name: migration.name,
      });

      if (dryRun) {
        this.logger.info(`[DRY RUN] Would execute: ${migration.name}`);
      } else {
        // Execute migration with or without transaction
        if (migration.disableTransaction) {
          await migration.up(context);
        } else {
          await this.prisma.$transaction(async (txPrisma) => {
            const txContext: MigrationContext = {
              ...context,
              prisma: txPrisma,
            };
            await migration.up(txContext);
          });
        }

        const duration = Date.now() - startTime;
        await this.recordMigration(migration, duration);
      }

      // Run afterEach hook
      await this.hooks.runAfterEach(this.prisma, this.logger, {
        id: migration.id,
        name: migration.name,
      });

      const duration = Date.now() - startTime;
      this.logger.migrationEnd(migration.id, migration.name, duration, true);
    } catch (error) {
      this.logger.migrationError(migration.id, error as Error);
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(options?: { dryRun?: boolean; waitForLock?: boolean }): Promise<MigrationResult> {
    const dryRun = options?.dryRun ?? false;
    const waitForLock = options?.waitForLock ?? false;
    const startTime = Date.now();
    const executedMigrations: string[] = [];

    try {
      // Acquire lock (with optional waiting)
      if (waitForLock) {
        this.logger.info("Waiting to acquire migration lock...");
        let acquired = false;
        let attempts = 0;
        
        while (!acquired) {
          acquired = await this.lock.acquire();
          if (!acquired) {
            attempts++;
            if (attempts === 1) {
              this.logger.info("Another instance is running migrations. Waiting...");
            } else if (attempts % 10 === 0) {
              this.logger.info(`Still waiting... (${attempts} attempts)`);
            }
            await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds before retry
          }
        }
        if (attempts > 0) {
          this.logger.info(`Lock acquired after ${attempts} attempt(s)`);
        }
      } else {
        // Fail fast if lock not available
        const lockAcquired = await this.lock.acquire();
        if (!lockAcquired) {
          throw new Error("Could not acquire migration lock. Another instance may be running migrations.");
        }
      }
      this.logger.lockAcquired(this.options.lock?.timeout || 30000);

      // Run beforeAll hook
      await this.hooks.runBeforeAll(this.prisma, this.logger);

      const status = await this.getStatus();
      
      if (status.pending.length === 0) {
        this.logger.info("No pending migrations");
        return { success: true, executedMigrations: [] };
      }

      this.logger.info(`Running ${status.pending.length} migration(s)...`);

      const executedIds = new Set(status.executed.map((r) => r.id));

      for (const migration of status.pending) {
        // Check dependencies
        const deps = await this.checkDependencies(migration, executedIds);
        if (!deps.ok) {
          throw new Error(
            `Migration ${migration.id} depends on missing migrations: ${deps.missing.join(", ")}`
          );
        }

        // Check condition
        const shouldRun = await this.checkCondition(migration);
        if (!shouldRun) {
          this.logger.info(`Skipping ${migration.id} - condition not met`);
          continue;
        }

        try {
          await this.executeMigration(migration, dryRun);
          executedMigrations.push(migration.id);
          executedIds.add(migration.id);
        } catch (error) {
          return {
            success: false,
            executedMigrations,
            failedMigration: migration.id,
            error: error as Error,
          };
        }
      }

      // Run afterAll hook
      await this.hooks.runAfterAll(this.prisma, this.logger);

      const totalTime = Date.now() - startTime;
      const metrics: MigrationMetrics = {
        totalTime,
        migrationsRun: executedMigrations.length,
        avgMigrationTime: totalTime / executedMigrations.length,
      };

      this.logger.info(`Successfully executed ${executedMigrations.length} migration(s)`);

      return {
        success: true,
        executedMigrations,
        metrics,
      };
    } catch (error) {
      return {
        success: false,
        executedMigrations,
        error: error as Error,
      };
    } finally {
      await this.lock.release();
      this.logger.lockReleased();
    }
  }

  /**
   * Rollback the last executed migration
   */
  async rollbackLast(): Promise<boolean> {
    const status = await this.getStatus();
    
    if (status.executed.length === 0) {
      this.logger.warn("No migrations to rollback");
      return false;
    }

    const lastRecord = status.executed[status.executed.length - 1];
    const allMigrations = await loadMigrations(this.options.migrationsDir, this.config.typescript);
    const migration = allMigrations.find((m) => m.id === lastRecord.id);

    if (!migration) {
      this.logger.error(`Migration ${lastRecord.id} not found in migrations directory`);
      return false;
    }

    if (!migration.down) {
      this.logger.error(`Migration ${migration.id} does not have a rollback function`);
      return false;
    }

    this.logger.info(`Rolling back: ${migration.id} - ${migration.name}`);

    try {
      const context = this.createContext();

      await this.prisma.$transaction(async (txPrisma) => {
        const txContext: MigrationContext = {
          ...context,
          prisma: txPrisma,
        };
        await migration.down!(txContext);
      });

      // Remove the migration record
      const tableName = this.options.migrationsTable;
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "${tableName}" WHERE "id" = $1`,
        migration.id
      );

      this.logger.info("Rolled back successfully");
      return true;
    } catch (error) {
      this.logger.error(`Rollback failed: ${error}`);
      return false;
    }
  }

  /**
   * Reset all migrations (DANGER: removes all migration records)
   */
  async reset(): Promise<void> {
    const tableName = this.options.migrationsTable;
    await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
    this.logger.warn("All migration records cleared");
  }
}
