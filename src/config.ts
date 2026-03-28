import * as path from "path";
import * as fs from "fs";

export interface Config {
  /** Directory containing migration files */
  migrationsDir: string;
  /** Table name to store migration history */
  migrationsTable: string;
  /** Path to Prisma schema file */
  schemaPath?: string;
  /** TypeScript compiler options */
  typescript?: {
    /** Compiler to use: 'ts-node' or 'tsx' */
    compiler?: "ts-node" | "tsx";
    /** Skip type checking for faster compilation */
    transpileOnly?: boolean;
  };
  /** Logging configuration */
  logging?: {
    /** Log level: 'silent', 'error', 'warn', 'info', 'debug' */
    level?: "silent" | "error" | "warn" | "info" | "debug";
    /** Enable progress indicators */
    progress?: boolean;
  };
  /** Lock configuration for distributed environments */
  lock?: {
    /** Enable distributed locking */
    enabled?: boolean;
    /** Lock timeout in milliseconds */
    timeout?: number;
    /** Retry attempts if lock is not acquired */
    retryAttempts?: number;
    /** Retry delay in milliseconds */
    retryDelay?: number;
  };
  /** Migration execution options */
  execution?: {
    /** Default timeout for migrations in milliseconds */
    timeout?: number;
    /** Allow transactions to be disabled for specific migrations */
    transaction?: boolean;
  };
  /** Hooks for lifecycle events */
  hooks?: {
    /** Run before any migrations start */
    beforeAll?: string;
    /** Run after all migrations complete */
    afterAll?: string;
    /** Run before each migration */
    beforeEach?: string;
    /** Run after each migration */
    afterEach?: string;
  };
}

export const defaultConfig: Config = {
  migrationsDir: "./prisma/data-migrations",
  migrationsTable: "_dataMigration",
  typescript: {
    compiler: "tsx",
    transpileOnly: true,
  },
  logging: {
    level: "info",
    progress: true,
  },
  lock: {
    enabled: false,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  execution: {
    timeout: 0, // 0 = no timeout
    transaction: true,
  },
};

const configFiles = [
  "prisma-shift.config.ts",
  "prisma-shift.config.js",
  "prisma-shift.config.mjs",
  "prisma-shift.config.json",
  ".prisma-shiftrc",
  ".prisma-shiftrc.json",
  ".prisma-shiftrc.js",
  ".prisma-shiftrc.mjs",
];

/**
 * Find and load config file from current directory
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const configPath = findConfigFile(cwd);
  
  if (!configPath) {
    return { ...defaultConfig };
  }

  return loadConfigFromPath(configPath);
}

/**
 * Find config file in directory
 */
function findConfigFile(cwd: string): string | null {
  for (const file of configFiles) {
    const fullPath = path.join(cwd, file);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Load config from specific path
 */
async function loadConfigFromPath(configPath: string): Promise<Config> {
  const ext = path.extname(configPath);

  try {
    if (ext === ".json" || configPath.endsWith("rc")) {
      // JSON config
      const content = fs.readFileSync(configPath, "utf8");
      const parsed = JSON.parse(content);
      return mergeConfig(defaultConfig, parsed);
    } else {
      // TypeScript/JavaScript config
      // Clear require cache to allow reloading
      delete require.cache[require.resolve(configPath)];
      
      const module = await import(configPath);
      const exported = module.default || module;
      
      // Handle function configs
      const config = typeof exported === "function" ? await exported() : exported;
      
      return mergeConfig(defaultConfig, config);
    }
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

/**
 * Deep merge config with defaults
 */
export function mergeConfig(defaults: Config, user: Partial<Config>): Config {
  return {
    migrationsDir: user.migrationsDir ?? defaults.migrationsDir,
    migrationsTable: user.migrationsTable ?? defaults.migrationsTable,
    schemaPath: user.schemaPath ?? defaults.schemaPath,
    typescript: {
      ...defaults.typescript,
      ...user.typescript,
    },
    logging: {
      ...defaults.logging,
      ...user.logging,
    },
    lock: {
      ...defaults.lock,
      ...user.lock,
    },
    execution: {
      ...defaults.execution,
      ...user.execution,
    },
    hooks: user.hooks ?? defaults.hooks,
  };
}

/**
 * Create a sample config file
 */
export function createSampleConfig(cwd: string = process.cwd()): string {
  const configPath = path.join(cwd, "prisma-shift.config.ts");
  
  if (fs.existsSync(configPath)) {
    throw new Error(`Config file already exists at ${configPath}`);
  }

  const sampleConfig = `import { Config } from "prisma-shift";

const config: Config = {
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
  
  // Distributed locking (for production)
  lock: {
    // Enable to prevent concurrent migrations
    enabled: false,
    // Lock timeout in milliseconds
    timeout: 30000,
    // Retry attempts if lock is not acquired
    retryAttempts: 3,
  },
  
  // Migration execution options
  execution: {
    // Default timeout for migrations (0 = no timeout)
    timeout: 0,
    // Run migrations in transactions
    transaction: true,
  },
  
  // Lifecycle hooks
  hooks: {
    // Run before any migrations start
    // beforeAll: "./scripts/backup.ts",
    // Run after all migrations complete
    // afterAll: "./scripts/notify.ts",
  },
};

export default config;
`;

  fs.writeFileSync(configPath, sampleConfig);
  return configPath;
}
