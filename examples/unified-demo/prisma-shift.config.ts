/**
 * Prisma Shift Configuration
 * 
 * This config demonstrates all the advanced features:
 * - Distributed locking
 * - Structured logging
 * - Lifecycle hooks
 * - TypeScript compilation options
 */

export default {
  // Directory containing your data migration files
  migrationsDir: "./prisma/data-migrations",

  // Database table to track migration history
  migrationsTable: "_dataMigration",

  // TypeScript compilation options
  typescript: {
    // Use 'tsx' (faster) or 'ts-node' (more compatible)
    compiler: "tsx",
    // Skip type checking for faster compilation
    transpileOnly: true,
  },

  // Logging configuration
  logging: {
    // Log level: 'silent', 'error', 'warn', 'info', 'debug'
    level: "info",
    // Show progress bars for batch operations
    progress: true,
  },

  // Distributed locking (prevents concurrent migrations)
  lock: {
    // Enable to prevent concurrent migrations in multi-instance deployments
    enabled: true,
    // Lock timeout in milliseconds
    timeout: 30000,
    // Retry attempts if lock is not acquired
    retryAttempts: 3,
    // Delay between retries
    retryDelay: 1000,
  },

  // Migration execution options
  execution: {
    // Default timeout for migrations (0 = no timeout)
    timeout: 0,
    // Run migrations in transactions (can be overridden per-migration)
    transaction: true,
  },

  // Lifecycle hooks
  hooks: {
    // Run before any migrations start
    // Uncomment to enable backup before migrations:
    // beforeAll: "./scripts/backup.ts",
    
    // Run after all migrations complete
    // Uncomment to enable notifications:
    // afterAll: "./scripts/notify.ts",
  },
};
