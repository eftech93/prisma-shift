/**
 * Migration validation utilities
 */

import * as fs from "fs";
import * as path from "path";
import { DataMigration, ValidationResult, ValidationError } from "./types";
import { loadMigrations, validateMigrationFile } from "./utils";
import { MigrationRecord } from "./types";

export interface ValidationOptions {
  /** Check for duplicate IDs */
  checkDuplicates?: boolean;
  /** Check for conflicts with executed migrations */
  checkConflicts?: boolean;
  /** Validate TypeScript syntax */
  checkSyntax?: boolean;
  /** Check dependency references */
  checkDependencies?: boolean;
  /** TypeScript options for loading */
  typescript?: import("./utils").TypeScriptOptions;
}

/**
 * Validate all migrations in a directory
 */
export async function validateMigrations(
  migrationsDir: string,
  executedMigrations: MigrationRecord[],
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const {
    checkDuplicates = true,
    checkConflicts = true,
    checkSyntax = true,
    checkDependencies = true,
  } = options;

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check directory exists
  if (!fs.existsSync(migrationsDir)) {
    return {
      valid: false,
      errors: [{
        migrationId: "",
        type: "runtime",
        message: `Migrations directory does not exist: ${migrationsDir}`,
      }],
      warnings: [],
    };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

  if (files.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Check for syntax errors
  if (checkSyntax) {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const result = validateMigrationFile(filePath);
      
      if (!result.valid) {
        errors.push({
          migrationId: file.replace(/\.(ts|js)$/, ""),
          type: "syntax",
          message: result.error || "Unknown syntax error",
        });
      }
    }
  }

  // Load migrations for deeper validation
  let migrations: DataMigration[] = [];
  try {
    migrations = await loadMigrations(migrationsDir, options.typescript);
  } catch (error) {
    errors.push({
      migrationId: "",
      type: "runtime",
      message: `Failed to load migrations: ${error}`,
    });
    return { valid: false, errors, warnings };
  }

  // Check for duplicate IDs
  if (checkDuplicates) {
    const idMap = new Map<string, string[]>();
    
    for (const migration of migrations) {
      const existing = idMap.get(migration.id) || [];
      existing.push(migration.name);
      idMap.set(migration.id, existing);
    }

    for (const [id, names] of idMap.entries()) {
      if (names.length > 1) {
        errors.push({
          migrationId: id,
          type: "conflict",
          message: `Duplicate migration ID "${id}" found in: ${names.join(", ")}`,
        });
      }
    }
  }

  // Check for conflicts with executed migrations
  if (checkConflicts) {
    const executedMap = new Map(executedMigrations.map((r) => [r.id, r]));
    const loadedIds = new Set(migrations.map((m) => m.id));

    for (const executed of executedMigrations) {
      if (!loadedIds.has(executed.id)) {
        warnings.push(
          `Migration "${executed.id}" was executed but file is missing. Rollback may not be possible.`
        );
      }
    }

    // Check for modified migrations (same ID but different name)
    for (const migration of migrations) {
      const executed = executedMap.get(migration.id);
      if (executed && executed.name !== migration.name) {
        errors.push({
          migrationId: migration.id,
          type: "conflict",
          message: `Migration name mismatch: file has "${migration.name}" but database has "${executed.name}"`,
        });
      }
    }
  }

  // Check dependency references
  if (checkDependencies) {
    const migrationIds = new Set(migrations.map((m) => m.id));
    const executedIds = new Set(executedMigrations.map((r) => r.id));
    const allIds = new Set([...migrationIds, ...executedIds]);

    for (const migration of migrations) {
      if (migration.requiresData) {
        for (const depId of migration.requiresData) {
          if (!allIds.has(depId)) {
            errors.push({
              migrationId: migration.id,
              type: "dependency",
              message: `Unknown dependency: "${depId}"`,
            });
          }
        }
      }

      if (migration.requiresSchema) {
        // Schema dependencies are harder to validate, just check format
        for (const depId of migration.requiresSchema) {
          if (!/^\d{14,}_.+$/.test(depId)) {
            warnings.push(
              `Migration "${migration.id}" has unusual schema dependency format: "${depId}"`
            );
          }
        }
      }
    }
  }

  // Validate migration properties
  for (const migration of migrations) {
    // Check ID format (should be timestamp_name)
    if (!/^\d{14,}_[a-z0-9_]+$/.test(migration.id)) {
      warnings.push(
        `Migration "${migration.id}" has non-standard ID format. Expected: YYYYMMDDHHMMSS_name`
      );
    }

    // Check name consistency
    const expectedName = migration.id.replace(/^\d+_/, "");
    if (migration.name !== expectedName) {
      warnings.push(
        `Migration "${migration.id}" name "${migration.name}" doesn't match ID (expected: "${expectedName}")`
      );
    }

    // Check createdAt is reasonable
    const createdAt = new Date(migration.createdAt);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (createdAt < oneYearAgo || createdAt > oneYearFromNow) {
      warnings.push(
        `Migration "${migration.id}" has unusual createdAt timestamp: ${createdAt.toISOString()}`
      );
    }

    // Check for rollback without down function
    if (!migration.down) {
      warnings.push(`Migration "${migration.id}" does not have a rollback function`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    lines.push("✓ All migrations are valid");
    return lines.join("\n");
  }

  if (result.valid) {
    lines.push("✓ Migrations are valid with warnings:\n");
  } else {
    lines.push("✗ Migration validation failed:\n");
  }

  for (const error of result.errors) {
    lines.push(`  [${error.type.toUpperCase()}] ${error.migrationId}`);
    lines.push(`    ${error.message}`);
    if (error.line) {
      lines.push(`    at line ${error.line}${error.column ? `:${error.column}` : ""}`);
    }
    lines.push("");
  }

  for (const warning of result.warnings) {
    lines.push(`  [WARNING] ${warning}`);
  }

  return lines.join("\n");
}
