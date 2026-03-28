import {
  generateMigrationId,
  generateMigrationTemplate,
  ensureMigrationsDir,
} from "../src/utils";

describe("Utils", () => {
  describe("generateMigrationId", () => {
    it("should generate ID with timestamp and name", () => {
      const id = generateMigrationId("test_migration");
      
      expect(id).toMatch(/^\d{14}_test_migration$/);
    });

    it("should handle name with spaces", () => {
      const id = generateMigrationId("test migration name");
      
      expect(id).toContain("test_migration_name");
    });

    it("should handle name with special characters", () => {
      const id = generateMigrationId("test-migration@name!");
      
      expect(id).not.toContain("@");
      expect(id).not.toContain("!");
    });
  });

  describe("generateMigrationTemplate", () => {
    it("should generate valid TypeScript template", () => {
      const template = generateMigrationTemplate(
        "20240324120000_test",
        "test_migration"
      );

      expect(template).toContain('import { DataMigration, MigrationContext } from "prisma-shift"');
      expect(template).toContain('id: "20240324120000_test"');
      expect(template).toContain('name: "test_migration"');
      expect(template).toContain("async up");
      expect(template).toContain("async down");
    });
  });

  describe("ensureMigrationsDir", () => {
    it("should be defined", () => {
      expect(ensureMigrationsDir).toBeDefined();
      expect(typeof ensureMigrationsDir).toBe("function");
    });
  });
});
