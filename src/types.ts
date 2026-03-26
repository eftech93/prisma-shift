import { PrismaClient } from "@prisma/client";

export interface MigrationContext {
  prisma: PrismaClient;
  log: (message: string) => void;
}

export interface DataMigration {
  /** Unique identifier for the migration (e.g., "20240324120000_add_user_preferences") */
  id: string;

  /** Human-readable description of what this migration does */
  name: string;

  /** Timestamp when migration was created (for ordering) */
  createdAt: number;

  /** The actual migration function */
  up: (context: MigrationContext) => Promise<void>;

  /** Optional rollback function */
  down?: (context: MigrationContext) => Promise<void>;
}

export interface MigrationRecord {
  id: string;
  name: string;
  createdAt: Date;
  executedAt: Date;
  duration: number; // in milliseconds
}

export interface MigrationOptions {
  /** Directory containing migration files */
  migrationsDir: string;

  /** Table name to store migration history (default: "_dataMigration") */
  migrationsTable?: string;

  /** Prisma schema path (default: "./prisma/schema.prisma") */
  schemaPath?: string;

  /** Whether to run migrations automatically on startup */
  autoRun?: boolean;
}

export interface MigrationStatus {
  pending: DataMigration[];
  executed: MigrationRecord[];
  all: (DataMigration & { status: "pending" | "executed"; executedAt?: Date; duration?: number })[];
}

export interface MigrationResult {
  success: boolean;
  executedMigrations: string[];
  failedMigration?: string;
  error?: Error;
}

export type PrismaClientLike = {
  $queryRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  $transaction: <T>(fn: (prisma: any) => Promise<T>, options?: any) => Promise<T>;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};
