import {
  DataMigration,
  MigrationRecord,
  MigrationOptions,
  MigrationStatus,
  MigrationResult,
  MigrationContext,
  PrismaClientLike,
} from "./types";
import { loadMigrations } from "./utils";

export class MigrationRunner {
  private prisma: PrismaClientLike;
  private options: Required<MigrationOptions>;

  constructor(prisma: PrismaClientLike, options: MigrationOptions) {
    this.prisma = prisma;
    this.options = {
      migrationsTable: "_dataMigration",
      schemaPath: "./prisma/schema.prisma",
      autoRun: false,
      ...options,
    };
  }

  /**
   * Ensure the migrations table exists
   */
  async ensureMigrationsTable(): Promise<void> {
    const tableName = this.options.migrationsTable;
    
    // Try to query the table to see if it exists
    try {
      await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM "${tableName}" LIMIT 1`
      );
    } catch {
      // Table doesn't exist, create it
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE "${tableName}" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL,
          "executedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "duration" INTEGER NOT NULL
        )
      `);
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
      loadMigrations(this.options.migrationsDir),
      this.getExecutedMigrations(),
    ]);

    const executedIds = new Set(executedRecords.map((r) => r.id));
    const pending = (allMigrations || []).filter((m) => !executedIds.has(m.id));
    const executed = executedRecords || [];

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
   * Execute a single migration
   */
  private async executeMigration(migration: DataMigration): Promise<void> {
    const startTime = Date.now();
    
    const context: MigrationContext = {
      prisma: this.prisma as any,
      log: (message: string) => {
        console.log(`  → ${message}`);
      },
    };

    // Run the migration inside a transaction for safety
    await this.prisma.$transaction(async (txPrisma) => {
      const txContext: MigrationContext = {
        prisma: txPrisma,
        log: context.log,
      };
      
      await migration.up(txContext);
    });

    const duration = Date.now() - startTime;
    await this.recordMigration(migration, duration);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<MigrationResult> {
    const status = await this.getStatus();
    
    if (status.pending.length === 0) {
      console.log("✓ No pending migrations");
      return { success: true, executedMigrations: [] };
    }

    console.log(`\n→ Running ${status.pending.length} migration(s)...\n`);

    const executedMigrations: string[] = [];

    for (const migration of status.pending) {
      console.log(`  ${migration.id} - ${migration.name}`);
      
      try {
        await this.executeMigration(migration);
        executedMigrations.push(migration.id);
        console.log(`  ✓ Done\n`);
      } catch (error) {
        console.error(`  ✗ Failed: ${error}\n`);
        return {
          success: false,
          executedMigrations,
          failedMigration: migration.id,
          error: error as Error,
        };
      }
    }

    console.log(`✓ Successfully executed ${executedMigrations.length} migration(s)\n`);
    return { success: true, executedMigrations };
  }

  /**
   * Rollback the last executed migration
   */
  async rollbackLast(): Promise<boolean> {
    const status = await this.getStatus();
    
    if (status.executed.length === 0) {
      console.log("No migrations to rollback");
      return false;
    }

    const lastRecord = status.executed[status.executed.length - 1];
    const allMigrations = await loadMigrations(this.options.migrationsDir);
    const migration = allMigrations.find((m) => m.id === lastRecord.id);

    if (!migration) {
      console.error(`Migration ${lastRecord.id} not found in migrations directory`);
      return false;
    }

    if (!migration.down) {
      console.error(`Migration ${migration.id} does not have a rollback function`);
      return false;
    }

    console.log(`\n→ Rolling back: ${migration.id} - ${migration.name}\n`);

    try {
      const context: MigrationContext = {
        prisma: this.prisma as any,
        log: (message: string) => {
          console.log(`  → ${message}`);
        },
      };

      await this.prisma.$transaction(async (txPrisma) => {
        const txContext: MigrationContext = {
          prisma: txPrisma,
          log: context.log,
        };
        await migration.down!(txContext);
      });

      // Remove the migration record
      const tableName = this.options.migrationsTable;
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "${tableName}" WHERE "id" = $1`,
        migration.id
      );

      console.log(`✓ Rolled back successfully\n`);
      return true;
    } catch (error) {
      console.error(`✗ Rollback failed: ${error}\n`);
      return false;
    }
  }

  /**
   * Reset all migrations (DANGER: removes all migration records)
   */
  async reset(): Promise<void> {
    const tableName = this.options.migrationsTable;
    await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
    console.log("✓ All migration records cleared");
  }
}
