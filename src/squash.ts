import * as fs from "fs";
import * as path from "path";
import { DataMigration } from "./types";
import { generateMigrationId, loadMigrations } from "./utils";

export interface SquashRange {
  from: string;
  to: string;
}

export interface SquashSource {
  migration: DataMigration;
  filePath: string;
  body: string;
  imports: string[];
}

/**
 * Find migrations whose IDs fall within the given range (inclusive).
 * String comparison works because IDs are timestamp-prefixed.
 */
export function findMigrationsInRange(
  migrations: DataMigration[],
  range: SquashRange
): DataMigration[] {
  return migrations.filter((m) => m.id >= range.from && m.id <= range.to);
}

/**
 * Extract top-level import lines from a file.
 */
export function extractImports(fileContent: string): string[] {
  const lines = fileContent.split("\n");
  const imports: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) {
      imports.push(trimmed);
    }
  }
  return imports;
}

/**
 * Find the matching closing parenthesis for an opening one,
 * skipping strings and comments.
 */
function findClosingParen(content: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  let inString: string | null = null;
  let escaped = false;

  while (i < content.length && depth > 0) {
    const char = content[i];

    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      i++;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      i++;
      continue;
    }

    // Single-line comment
    if (char === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }

    // Multi-line comment
    if (char === "/" && content[i + 1] === "*") {
      i += 2;
      while (
        i < content.length &&
        !(content[i - 1] === "*" && content[i] === "/")
      ) {
        i++;
      }
      i++;
      continue;
    }

    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    }

    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

/**
 * Extract the body of the `up` function from migration source code.
 * Uses brace counting with basic string/comment awareness.
 */
export function extractUpBody(fileContent: string): string | null {
  // Find "async up(" or "up(" or "up:\s*async\s*(" or "up:\s*("
  const upRegex = /(?:async\s+up|up)\s*(?:\:|\s*\()/;
  const match = upRegex.exec(fileContent);
  if (!match) return null;

  // Find the opening parenthesis of the parameter list
  const parenOpen = fileContent.indexOf("(", match.index);
  if (parenOpen === -1) return null;

  // Find the matching closing parenthesis
  const parenClose = findClosingParen(fileContent, parenOpen);
  if (parenClose === -1) return null;

  // Find the opening brace after the parameter list (skip => and whitespace)
  let braceStart = -1;
  for (let i = parenClose + 1; i < fileContent.length; i++) {
    const char = fileContent[i];
    if (char === "{") {
      braceStart = i;
      break;
    }
    if (!/[\s=>]/.test(char)) {
      // Unexpected token before brace
      return null;
    }
  }

  if (braceStart === -1) return null;

  let depth = 1;
  let i = braceStart + 1;
  let inString: string | null = null;
  let escaped = false;

  while (i < fileContent.length && depth > 0) {
    const char = fileContent[i];

    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      i++;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      i++;
      continue;
    }

    // Single-line comment
    if (char === "/" && fileContent[i + 1] === "/") {
      while (i < fileContent.length && fileContent[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Multi-line comment
    if (char === "/" && fileContent[i + 1] === "*") {
      i += 2;
      while (
        i < fileContent.length &&
        !(fileContent[i - 1] === "*" && fileContent[i] === "/")
      ) {
        i++;
      }
      i++;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
    }

    i++;
  }

  if (depth !== 0) return null;

  return fileContent.substring(braceStart + 1, i - 1);
}

/**
 * Generate a squashed migration file from source migrations.
 */
export function generateSquashedMigration(
  newId: string,
  name: string,
  sources: SquashSource[]
): string {
  const allImports = [...new Set(sources.flatMap((s) => s.imports))];

  // Ensure the standard prisma-shift import is present
  if (!allImports.some((imp) => imp.includes('"prisma-shift"'))) {
    allImports.unshift(
      'import { DataMigration, MigrationContext } from "prisma-shift";'
    );
  }

  const upBodies = sources
    .map((s) => {
      const indentedBody = s.body
        .split("\n")
        .map((line) => {
          // Preserve relative indentation by adding 4 spaces
          return "    " + line;
        })
        .join("\n");

      return `    // --- Start: ${s.migration.id} (${s.migration.name}) ---\n${indentedBody}\n    // --- End: ${s.migration.id} ---`;
    })
    .join("\n\n");

  return `${allImports.join("\n")}

/**
 * Squashed Migration: ${name}
 * Created at: ${new Date().toISOString()}
 * Contains ${sources.length} migration(s):
${sources.map((s) => ` *   - ${s.migration.id}: ${s.migration.name}`).join("\n")}
 */
const migration: DataMigration = {
  id: "${newId}",
  name: "${name}",
  createdAt: ${Date.now()},

  async up({ prisma, log, batch }: MigrationContext) {
    log("Running squashed migration: ${name}");

${upBodies}
  },
};

export default migration;
`;
}

export interface SquashFilesResult {
  newId: string;
  newFilePath: string;
  matchedMigrations: DataMigration[];
  removedFiles: string[];
  generatedContent: string;
}

/**
 * Squash migration files on disk.
 */
export async function squashMigrations(
  migrationsDir: string,
  range: SquashRange,
  newName: string,
  options: {
    keep?: boolean;
    dryRun?: boolean;
    generateId?: (name: string) => string;
  } = {}
): Promise<SquashFilesResult> {
  const migrations = await loadMigrations(migrationsDir);
  const matched = findMigrationsInRange(migrations, range);

  if (matched.length === 0) {
    throw new Error(
      `No migrations found in range ${range.from} to ${range.to}`
    );
  }

  const generateId = options.generateId || generateMigrationId;
  const newId = generateId(newName);
  const newFileName = `${newId}.ts`;
  const newFilePath = path.join(migrationsDir, newFileName);

  const sources: SquashSource[] = matched.map((m) => {
    let actualPath = path.join(migrationsDir, `${m.id}.ts`);
    let content = "";

    if (fs.existsSync(actualPath)) {
      content = fs.readFileSync(actualPath, "utf8");
    } else {
      const jsPath = path.join(migrationsDir, `${m.id}.js`);
      if (fs.existsSync(jsPath)) {
        actualPath = jsPath;
        content = fs.readFileSync(jsPath, "utf8");
      }
    }

    const body = extractUpBody(content) || "";
    const imports = extractImports(content);
    return { migration: m, filePath: actualPath, body, imports };
  });

  const generatedContent = generateSquashedMigration(newId, newName, sources);

  if (!options.dryRun) {
    fs.writeFileSync(newFilePath, generatedContent);
  }

  const removedFiles: string[] = [];
  if (!options.dryRun && !options.keep) {
    for (const s of sources) {
      if (fs.existsSync(s.filePath)) {
        fs.unlinkSync(s.filePath);
        removedFiles.push(s.filePath);
      }
    }
  }

  return {
    newId,
    newFilePath,
    matchedMigrations: matched,
    removedFiles,
    generatedContent,
  };
}
