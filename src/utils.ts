import * as fs from "fs";
import * as path from "path";
import { DataMigration } from "./types";

/**
 * TypeScript loader options
 */
export interface TypeScriptOptions {
  compiler?: "ts-node" | "tsx";
  transpileOnly?: boolean;
}

/**
 * Generate a migration ID based on current timestamp
 */
export function generateMigrationId(name: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14); // YYYYMMDDHHMMSS
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${timestamp}_${sanitizedName}`;
}

/**
 * Register TypeScript loader if available
 */
function registerTypeScriptLoader(options?: TypeScriptOptions): void {
  const compiler = options?.compiler ?? "tsx";
  const transpileOnly = options?.transpileOnly ?? true;

  if (compiler === "tsx") {
    // Try tsx first (faster, no type checking)
    try {
      require.resolve("tsx/cjs", { paths: [process.cwd()] });
      require(path.join(process.cwd(), "node_modules/tsx/cjs"));
      return;
    } catch {
      try {
        require("tsx/cjs");
        return;
      } catch {
        // tsx not available, fall back to ts-node
      }
    }
  }

  // Fall back to ts-node with transpile-only mode
  try {
    const tsNode = require(path.join(process.cwd(), "node_modules/ts-node"));
    tsNode.register({
      transpileOnly,
      skipProject: true,
      compilerOptions: {
        module: "commonjs",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      },
    });
    return;
  } catch {
    try {
      const tsNode = require("ts-node");
      tsNode.register({
        transpileOnly,
        skipProject: true,
        compilerOptions: {
          module: "commonjs",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
        },
      });
      return;
    } catch {
      // ts-node not available
    }
  }
}

/**
 * Check if TypeScript support is needed and available
 */
function ensureTypeScriptSupport(files: string[], options?: TypeScriptOptions): void {
  const hasTypeScript = files.some((f) => f.endsWith(".ts"));
  
  if (!hasTypeScript) {
    return;
  }

  registerTypeScriptLoader(options);

  if (!require.extensions[".ts"]) {
    throw new Error(
      `TypeScript migrations found but no TypeScript loader is available.\n` +
      `Please install ts-node or tsx as a dev dependency:\n` +
      `  npm install --save-dev ts-node\n` +
      `  or\n` +
      `  npm install --save-dev tsx`
    );
  }
}

/**
 * Load all migration files from a directory
 */
export async function loadMigrations(
  migrationsDir: string,
  typescriptOptions?: TypeScriptOptions
): Promise<DataMigration[]> {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

  ensureTypeScriptSupport(files, typescriptOptions);

  const migrations: DataMigration[] = [];

  for (const file of files) {
    const filePath = path.resolve(migrationsDir, file);
    const migrationModule = await import(filePath);
    
    const migration: DataMigration = migrationModule.default || migrationModule.migration;
    
    if (!migration) {
      throw new Error(`Migration file ${file} must export a migration object (default or named export)`);
    }

    if (!migration.id || !migration.up) {
      throw new Error(`Migration ${file} must have 'id' and 'up' properties`);
    }

    migrations.push(migration);
  }

  migrations.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.id.localeCompare(b.id);
  });

  return migrations;
}

/**
 * Create the migrations directory if it doesn't exist
 */
export function ensureMigrationsDir(migrationsDir: string): void {
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
}

/**
 * Generate a migration file template
 */
export function generateMigrationTemplate(id: string, name: string): string {
  return `import { DataMigration, MigrationContext } from "prisma-shift";

/**
 * Migration: ${name}
 * Created at: ${new Date().toISOString()}
 */
const migration: DataMigration = {
  id: "${id}",
  name: "${name}",
  createdAt: ${Date.now()},

  async up({ prisma, log, batch }: MigrationContext) {
    // Write your migration code here
    // Example:
    // await prisma.user.updateMany({
    //   where: { emailVerified: null },
    //   data: { emailVerified: false }
    // });
    
    // For large datasets, use batch processing:
    // await batch({
    //   query: () => prisma.post.findMany({ where: { processed: false } }),
    //   batchSize: 1000,
    //   process: async (posts) => { /* ... */ }
    // });
    
    log("Running migration: ${name}");
  },

  // Optional: rollback function
  // async down({ prisma, log }: MigrationContext) {
  //   log("Rolling back migration: ${name}");
  // }
  
  // Optional: condition to check before running
  // condition: async ({ prisma }) => {
  //   const count = await prisma.user.count();
  //   return count > 0;
  // }
};

export default migration;
`;
}

/**
 * Check if running in TypeScript environment
 */
export function isTypeScriptEnvironment(): boolean {
  return !!require.extensions[".ts"];
}

/**
 * Validate migration file syntax
 */
export function validateMigrationFile(filePath: string): { valid: boolean; error?: string } {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    
    // Basic syntax checks
    if (!content.includes("export default") && !content.includes("export const migration")) {
      return { valid: false, error: "Migration must have a default export or named 'migration' export" };
    }
    
    if (!content.includes("id:")) {
      return { valid: false, error: "Migration must have an 'id' property" };
    }
    
    if (!content.includes("up:")) {
      return { valid: false, error: "Migration must have an 'up' function" };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Failed to read file: ${error}` };
  }
}
