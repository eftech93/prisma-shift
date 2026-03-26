import * as fs from "fs";
import * as path from "path";
import { DataMigration } from "./types";

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
function registerTypeScriptLoader(): void {
  // Check if tsx/cjs is available first (faster, no type checking)
  try {
    require.resolve("tsx/cjs", { paths: [process.cwd()] });
    require(path.join(process.cwd(), "node_modules/tsx/cjs"));
    return;
  } catch {
    try {
      require("tsx/cjs");
      return;
    } catch {
      // tsx not available
    }
  }

  // Fall back to ts-node with transpile-only mode
  try {
    const tsNode = require(path.join(process.cwd(), "node_modules/ts-node"));
    tsNode.register({
      transpileOnly: true,
      skipProject: true, // Don't use the project's tsconfig.json
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
        transpileOnly: true,
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
function ensureTypeScriptSupport(files: string[]): void {
  const hasTypeScript = files.some((f) => f.endsWith(".ts"));
  
  if (!hasTypeScript) {
    return;
  }

  // Try to register TypeScript loader
  registerTypeScriptLoader();

  // Check if TypeScript is now supported
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
export async function loadMigrations(migrationsDir: string): Promise<DataMigration[]> {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

  // Ensure TypeScript support is available if needed
  ensureTypeScriptSupport(files);

  const migrations: DataMigration[] = [];

  for (const file of files) {
    // Use absolute path to ensure correct resolution
    const filePath = path.resolve(migrationsDir, file);
    const migrationModule = await import(filePath);
    
    // Support both default export and named export
    const migration: DataMigration = migrationModule.default || migrationModule.migration;
    
    if (!migration) {
      throw new Error(`Migration file ${file} must export a migration object (default or named export)`);
    }

    if (!migration.id || !migration.up) {
      throw new Error(`Migration ${file} must have 'id' and 'up' properties`);
    }

    migrations.push(migration);
  }

  // Sort by createdAt, then by id as fallback
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

  async up({ prisma, log }: MigrationContext) {
    // Write your migration code here
    // Example:
    // await prisma.user.updateMany({
    //   where: { emailVerified: null },
    //   data: { emailVerified: false }
    // });
    
    log("Running migration: ${name}");
  },

  // Optional: rollback function
  // async down({ prisma, log }: MigrationContext) {
  //   log("Rolling back migration: ${name}");
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
