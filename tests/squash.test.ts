import * as fs from "fs";
import {
  findMigrationsInRange,
  extractImports,
  extractUpBody,
  generateSquashedMigration,
  squashMigrations,
} from "../src/squash";
import { DataMigration } from "../src/types";

jest.mock("fs");
jest.mock("../src/utils", () => ({
  ...jest.requireActual("../src/utils"),
  loadMigrations: jest.fn(),
}));

import { loadMigrations } from "../src/utils";

describe("Squash", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("findMigrationsInRange", () => {
    it("should find migrations within ID range", () => {
      const migrations: DataMigration[] = [
        { id: "20240301000000_first", name: "first", createdAt: 1, up: jest.fn() },
        { id: "20240315000000_second", name: "second", createdAt: 2, up: jest.fn() },
        { id: "20240331000000_third", name: "third", createdAt: 3, up: jest.fn() },
      ];

      const result = findMigrationsInRange(migrations, {
        from: "20240301",
        to: "20240330",
      });

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual([
        "20240301000000_first",
        "20240315000000_second",
      ]);
    });

    it("should return empty array when no migrations match", () => {
      const migrations: DataMigration[] = [
        { id: "20240301000000_first", name: "first", createdAt: 1, up: jest.fn() },
      ];

      const result = findMigrationsInRange(migrations, {
        from: "20240401",
        to: "20240430",
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("extractImports", () => {
    it("should extract import statements", () => {
      const content = `
import { DataMigration } from "prisma-shift";
import { something } from "./local";

const x = 1;
`;
      const imports = extractImports(content);
      expect(imports).toHaveLength(2);
      expect(imports[0]).toContain('"prisma-shift"');
      expect(imports[1]).toContain('"./local"');
    });

    it("should deduplicate identical imports", () => {
      const content = `
import { A } from "mod";
import { B } from "mod";
`;
      const imports = extractImports(content);
      expect(imports).toHaveLength(2);
    });
  });

  describe("extractUpBody", () => {
    it("should extract body from standard async up function", () => {
      const content = `
const migration = {
  async up({ prisma, log }: MigrationContext) {
    log("hello");
    await prisma.user.create({ data: {} });
  },
};
`;
      const body = extractUpBody(content);
      expect(body).toContain('log("hello")');
      expect(body).toContain("prisma.user.create");
      expect(body).not.toContain("async up");
    });

    it("should handle nested braces and strings", () => {
      const content = `
const migration = {
  async up({ prisma }: MigrationContext) {
    const obj = { a: { b: 1 } };
    const str = "{ not a brace }";
    const tpl = \`template { \${obj.a.b} }\`;
  },
};
`;
      const body = extractUpBody(content);
      expect(body).toContain('const obj = { a: { b: 1 } }');
      expect(body).toContain('"{ not a brace }"');
      expect(body).toContain("\`template { \${obj.a.b} }\`");
    });

    it("should handle comments inside body", () => {
      const content = `
const migration = {
  async up({ log }: MigrationContext) {
    // single line
    /* multi
       line */
    log("done");
  },
};
`;
      const body = extractUpBody(content);
      expect(body).toContain('log("done")');
      // Comments are preserved in the extracted body
      expect(body).toContain("// single line");
      expect(body).toContain("/* multi");
    });

    it("should return null when no up function exists", () => {
      const content = `const x = 1;`;
      const body = extractUpBody(content);
      expect(body).toBeNull();
    });

    it("should handle escaped characters in strings", () => {
      const content = `
const migration = {
  async up({ log }: MigrationContext) {
    const str = "quote \\\" brace {";
    const str2 = 'quote \\\' brace {';
  },
};
`;
      const body = extractUpBody(content);
      expect(body).toContain('"quote \\\" brace {"');
      expect(body).toContain("'quote \\\' brace {'");
    });
  });

  describe("generateSquashedMigration", () => {
    it("should generate a valid squashed migration file", () => {
      const sources = [
        {
          migration: {
            id: "20240301000000_first",
            name: "first",
            createdAt: 1,
            up: jest.fn(),
          } as DataMigration,
          filePath: "/migrations/20240301000000_first.ts",
          body: '    log("first");',
          imports: ['import { DataMigration } from "prisma-shift";'],
        },
      ];

      const result = generateSquashedMigration(
        "20240331000000_squashed",
        "squashed",
        sources
      );

      expect(result).toContain('id: "20240331000000_squashed"');
      expect(result).toContain('name: "squashed"');
      expect(result).toContain('import { DataMigration } from "prisma-shift"');
      expect(result).toContain("// --- Start: 20240301000000_first (first) ---");
      expect(result).toContain('log("first")');
      expect(result).toContain("// --- End: 20240301000000_first ---");
    });

    it("should deduplicate imports", () => {
      const sources = [
        {
          migration: {
            id: "20240301000000_first",
            name: "first",
            createdAt: 1,
            up: jest.fn(),
          } as DataMigration,
          filePath: "/migrations/first.ts",
          body: "log(1);",
          imports: ['import { A } from "mod";'],
        },
        {
          migration: {
            id: "20240302000000_second",
            name: "second",
            createdAt: 2,
            up: jest.fn(),
          } as DataMigration,
          filePath: "/migrations/second.ts",
          body: "log(2);",
          imports: ['import { A } from "mod";'],
        },
      ];

      const result = generateSquashedMigration(
        "20240331000000_squashed",
        "squashed",
        sources
      );

      const matches = result.match(/import { A } from "mod";/g);
      expect(matches).toHaveLength(1);
    });

    it("should add prisma-shift import if missing", () => {
      const sources = [
        {
          migration: {
            id: "20240301000000_first",
            name: "first",
            createdAt: 1,
            up: jest.fn(),
          } as DataMigration,
          filePath: "/migrations/first.ts",
          body: "log(1);",
          imports: [],
        },
      ];

      const result = generateSquashedMigration(
        "20240331000000_squashed",
        "squashed",
        sources
      );

      expect(result).toContain(
        'import { DataMigration, MigrationContext } from "prisma-shift";'
      );
    });
  });

  describe("squashMigrations", () => {
    it("should throw when no migrations match range", async () => {
      (loadMigrations as jest.Mock).mockResolvedValue([]);

      await expect(
        squashMigrations("./migrations", { from: "2024", to: "2024" }, "name")
      ).rejects.toThrow("No migrations found");
    });

    it("should create squashed file and remove old files", async () => {
      const mockMigrations: DataMigration[] = [
        {
          id: "20240301000000_first",
          name: "first",
          createdAt: 1,
          up: jest.fn(),
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);

      const fsMocked = jest.requireMock("fs") as typeof fs;
      fsMocked.existsSync = jest.fn().mockReturnValue(true);
      fsMocked.readFileSync = jest.fn().mockReturnValue(`
import { DataMigration, MigrationContext } from "prisma-shift";
const migration: DataMigration = {
  id: "20240301000000_first",
  name: "first",
  createdAt: 1,
  async up({ log }: MigrationContext) {
    log("first");
  },
};
export default migration;
`);
      fsMocked.writeFileSync = jest.fn();
      fsMocked.unlinkSync = jest.fn();

      const result = await squashMigrations(
        "./migrations",
        { from: "20240301", to: "20240331" },
        "squashed",
        { generateId: () => "20240331000000_squashed" }
      );

      expect(result.newId).toBe("20240331000000_squashed");
      expect(result.matchedMigrations).toHaveLength(1);
      expect(fsMocked.writeFileSync).toHaveBeenCalled();
      expect(fsMocked.unlinkSync).toHaveBeenCalled();
    });

    it("should keep old files when keep option is set", async () => {
      const mockMigrations: DataMigration[] = [
        {
          id: "20240301000000_first",
          name: "first",
          createdAt: 1,
          up: jest.fn(),
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);

      const fsMocked = jest.requireMock("fs") as typeof fs;
      fsMocked.existsSync = jest.fn().mockReturnValue(true);
      fsMocked.readFileSync = jest.fn().mockReturnValue(`
const migration = {
  async up({ log }: any) {
    log("first");
  },
};
`);
      fsMocked.writeFileSync = jest.fn();
      fsMocked.unlinkSync = jest.fn();

      await squashMigrations(
        "./migrations",
        { from: "20240301", to: "20240331" },
        "squashed",
        { keep: true, generateId: () => "20240331000000_squashed" }
      );

      expect(fsMocked.unlinkSync).not.toHaveBeenCalled();
    });

    it("should not write files in dry-run mode", async () => {
      const mockMigrations: DataMigration[] = [
        {
          id: "20240301000000_first",
          name: "first",
          createdAt: 1,
          up: jest.fn(),
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);

      const fsMocked = jest.requireMock("fs") as typeof fs;
      fsMocked.existsSync = jest.fn().mockReturnValue(true);
      fsMocked.readFileSync = jest.fn().mockReturnValue(`
const migration = {
  async up({ log }: any) {
    log("first");
  },
};
`);
      fsMocked.writeFileSync = jest.fn();
      fsMocked.unlinkSync = jest.fn();

      const result = await squashMigrations(
        "./migrations",
        { from: "20240301", to: "20240331" },
        "squashed",
        { dryRun: true, generateId: () => "20240331000000_squashed" }
      );

      expect(fsMocked.writeFileSync).not.toHaveBeenCalled();
      expect(fsMocked.unlinkSync).not.toHaveBeenCalled();
      expect(result.generatedContent).toContain("squashed");
    });
  });
});
