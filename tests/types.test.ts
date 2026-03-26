import { DataMigration, MigrationContext, MigrationRecord } from "../src/types";

describe("Types", () => {
  describe("DataMigration interface", () => {
    it("should accept valid migration object", () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test migration",
        createdAt: Date.now(),
        up: async (ctx: MigrationContext) => {
          ctx.log("Testing");
        },
        down: async (ctx: MigrationContext) => {
          ctx.log("Rolling back");
        },
      };

      expect(migration.id).toBe("20240324120000_test");
      expect(migration.name).toBe("test migration");
      expect(typeof migration.up).toBe("function");
      expect(typeof migration.down).toBe("function");
    });

    it("should accept migration without optional down function", () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test migration",
        createdAt: Date.now(),
        up: async () => {},
      };

      expect(migration.down).toBeUndefined();
    });
  });

  describe("MigrationRecord interface", () => {
    it("should accept valid migration record", () => {
      const record: MigrationRecord = {
        id: "20240324120000_test",
        name: "test migration",
        createdAt: new Date(),
        executedAt: new Date(),
        duration: 1000,
      };

      expect(record.id).toBe("20240324120000_test");
      expect(record.duration).toBe(1000);
    });
  });

  describe("MigrationContext interface", () => {
    it("should have required properties", () => {
      const mockPrisma = {} as any;
      const context: MigrationContext = {
        prisma: mockPrisma,
        log: (msg: string) => console.log(msg),
      };

      expect(context.prisma).toBe(mockPrisma);
      expect(typeof context.log).toBe("function");
    });
  });
});
