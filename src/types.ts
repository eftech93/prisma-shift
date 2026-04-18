import { PrismaClient } from "@prisma/client";
import { Logger } from "./logger";
import { BatchResult, BatchOptions } from "./batch";

// ============================================================================
// Core Types
// ============================================================================

export interface PrismaClientLike {
  $queryRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<any>;
  $transaction: <T>(fn: (prisma: any) => Promise<T>, options?: any) => Promise<T>;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
}

/**
 * Logger that can be called as a function (defaults to info level)
 * or used as an object with Logger methods
 */
export interface CallableLogger extends Logger {
  /** Call the logger directly as a shortcut for log.info() */
  (message: string): void;
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Context provided to migration up/down functions
 */
export interface MigrationContext {
  /** Prisma client instance */
  prisma: PrismaClient;
  /** Logger - call as log("msg") or use methods like log.info("msg") */
  log: CallableLogger;
  /** Batch processing helper for large datasets */
  batch: <T>(options: BatchOptions<T>) => Promise<BatchResult>;
  /** Create a progress tracker */
  progress: (total: number) => {
    increment: (amount?: number) => void;
    set: (value: number) => void;
    done: () => void;
  };
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Data migration definition
 */
export interface DataMigration {
  /** Unique identifier (e.g., "20240324120000_add_user_preferences") */
  id: string;
  /** Human-readable description */
  name: string;
  /** Timestamp when migration was created (for ordering) */
  createdAt: number;
  /** The actual migration function */
  up: (context: MigrationContext) => Promise<void>;
  /** Optional rollback function */
  down?: (context: MigrationContext) => Promise<void>;
  /** Condition to check before running (optional) */
  condition?: (context: Pick<MigrationContext, "prisma" | "log">) => Promise<boolean>;
  /** Schema migrations this data migration depends on */
  requiresSchema?: string[];
  /** Other data migrations this depends on */
  requiresData?: string[];
  /** Disable transaction for this migration (use with caution) */
  disableTransaction?: boolean;
  /** Custom timeout for this migration in milliseconds (0 = no timeout) */
  timeout?: number;
}

/**
 * Migration record stored in database
 */
export interface MigrationRecord {
  id: string;
  name: string;
  createdAt: Date;
  executedAt: Date;
  duration: number; // in milliseconds
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MigrationOptions {
  /** Directory containing migration files */
  migrationsDir: string;
  /** Table name to store migration history (default: "_dataMigration") */
  migrationsTable?: string;
  /** Path to Prisma schema file */
  schemaPath?: string;
  /** Whether to run migrations automatically on startup */
  autoRun?: boolean;
  /** Logger instance */
  logger?: Logger;
  /** Lock configuration */
  lock?: {
    enabled?: boolean;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
  /** Execution options */
  execution?: {
    timeout?: number;
    transaction?: boolean;
  };
  /** Lifecycle hooks */
  hooks?: {
    beforeAll?: string;
    afterAll?: string;
    beforeEach?: string;
    afterEach?: string;
  };
}

// ============================================================================
// Status & Result Types
// ============================================================================

export interface MigrationStatus {
  pending: DataMigration[];
  executed: MigrationRecord[];
  all: (DataMigration & { 
    status: "pending" | "executed"; 
    executedAt?: Date; 
    duration?: number;
  })[];
}

export interface MigrationMetrics {
  /** Total execution time in milliseconds */
  totalTime: number;
  /** Number of migrations executed */
  migrationsRun: number;
  /** Number of rows affected per migration */
  rowsAffected?: number[];
  /** Average migration time */
  avgMigrationTime?: number;
}

export interface MigrationResult {
  success: boolean;
  executedMigrations: string[];
  failedMigration?: string;
  error?: Error;
  metrics?: MigrationMetrics;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  migrationId: string;
  type: "syntax" | "runtime" | "dependency" | "conflict";
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = "json" | "csv" | "html";

export interface ExportOptions {
  format: ExportFormat;
  /** Output file path (optional, defaults to stdout) */
  output?: string;
  /** Include migration content */
  includeContent?: boolean;
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CLIOptions {
  /** Migrations directory */
  dir?: string;
  /** Migrations table name */
  table?: string;
  /** Prisma schema path */
  schema?: string;
  /** Log level */
  logLevel?: "silent" | "error" | "warn" | "info" | "debug";
  /** Disable progress indicators */
  noProgress?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Config file path */
  config?: string;
  /** Force operation without confirmation */
  force?: boolean;
}

// ============================================================================
// Squash Types
// ============================================================================

export interface SquashResult {
  success: boolean;
  removedRecords: number;
  addedRecord: boolean;
  updatedRecord: boolean;
  error?: string;
}

// ============================================================================
// Extension Types
// ============================================================================

export type WithDataMigrations<T> = T & {
  $dataMigrations: {
    run: () => Promise<MigrationResult>;
    status: () => Promise<MigrationStatus>;
    rollback: () => Promise<boolean>;
    reset: () => Promise<void>;
  };
};
