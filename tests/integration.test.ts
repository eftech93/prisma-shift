/**
 * Integration tests for prisma-shift
 * These tests use a mock Prisma client to simulate database operations
 */

import { MigrationRunner } from "../src/migration-runner";
import { DataMigration } from "../src/types";

// Mock loadMigrations
jest.mock("../src/utils", () => ({
  loadMigrations: jest.fn(),
}));

import { loadMigrations } from "../src/utils";

describe("Integration Tests", () => {
  let mockPrisma: any;
  let runner: MigrationRunner;

  beforeEach(() => {
    jest.resetAllMocks();

    // Create a more complete mock
    const migrationsTable: any[] = [];
    let tableExists = false;

    mockPrisma = {
      $queryRawUnsafe: jest.fn((query: string) => {
        if (query.includes("SELECT 1 FROM \"_dataMigration\"")) {
          if (!tableExists) {
            return Promise.reject(new Error("Table not found"));
          }
          return Promise.resolve([]);
        }
        if (query.includes('SELECT "id", "name"')) {
          return Promise.resolve(migrationsTable);
        }
        return Promise.resolve([]);
      }),
      $executeRawUnsafe: jest.fn((query: string, ...values: any[]) => {
        if (query.includes('CREATE TABLE "_dataMigration"')) {
          tableExists = true;
          return Promise.resolve(1);
        }
        if (query.includes('INSERT INTO "_dataMigration"')) {
          migrationsTable.push({
            id: values[0],
            name: values[1],
            createdAt: new Date(values[2]),
            duration: values[3],
          });
          return Promise.resolve(1);
        }
        if (query.includes('DELETE FROM "_dataMigration"')) {
          const count = migrationsTable.length;
          migrationsTable.length = 0;
          return Promise.resolve(count);
        }
        return Promise.resolve(1);
      }),
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
    };

    runner = new MigrationRunner(mockPrisma as any, {
      migrationsDir: "./migrations",
      migrationsTable: "_dataMigration",
    });
  });

  describe("MigrationRunner end-to-end flow", () => {
    it("should create migration table and run migrations", async () => {
      const mockMigration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([mockMigration]);

      const result = await runner.runMigrations();

      expect(result.success).toBe(true);
      expect(result.executedMigrations).toContain("20240324120000_test");
      expect(mockMigration.up).toHaveBeenCalled();
      
      // Verify migration was recorded
      const executed = await runner.getExecutedMigrations();
      expect(executed).toHaveLength(1);
      expect(executed[0].id).toBe("20240324120000_test");
    });

    it("should run multiple migrations in sequence", async () => {
      const executionOrder: string[] = [];

      const migration1: DataMigration = {
        id: "20240324110000_first",
        name: "first",
        createdAt: 1711281600000,
        up: jest.fn().mockImplementation(async () => {
          executionOrder.push("first");
        }),
      };

      const migration2: DataMigration = {
        id: "20240324120000_second",
        name: "second",
        createdAt: 1711285200000,
        up: jest.fn().mockImplementation(async () => {
          executionOrder.push("second");
        }),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([migration1, migration2]);

      await runner.runMigrations();

      expect(executionOrder).toEqual(["first", "second"]);
      expect(migration1.up).toHaveBeenCalled();
      expect(migration2.up).toHaveBeenCalled();
    });

    it("should skip already executed migrations", async () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
      };

      // First run
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      expect(migration.up).toHaveBeenCalledTimes(1);

      // Second run - should not execute again
      jest.clearAllMocks();
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      
      const result = await runner.runMigrations();

      expect(result.executedMigrations).toHaveLength(0);
      expect(migration.up).not.toHaveBeenCalled();
    });

    it("should stop on first failure and not execute subsequent migrations", async () => {
      const executionOrder: string[] = [];

      const migration1: DataMigration = {
        id: "20240324110000_first",
        name: "first",
        createdAt: 1711281600000,
        up: jest.fn().mockImplementation(async () => {
          executionOrder.push("first");
        }),
      };

      const migration2: DataMigration = {
        id: "20240324120000_failing",
        name: "failing",
        createdAt: 1711285200000,
        up: jest.fn().mockImplementation(async () => {
          executionOrder.push("failing");
          throw new Error("Migration failed");
        }),
      };

      const migration3: DataMigration = {
        id: "20240324130000_third",
        name: "third",
        createdAt: 1711288800000,
        up: jest.fn().mockImplementation(async () => {
          executionOrder.push("third");
        }),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([
        migration1,
        migration2,
        migration3,
      ]);

      const result = await runner.runMigrations();

      expect(result.success).toBe(false);
      expect(result.failedMigration).toBe("20240324120000_failing");
      expect(executionOrder).toEqual(["first", "failing"]);
      expect(migration3.up).not.toHaveBeenCalled();
    });

    it("should support rollback with down function", async () => {
      const downFn = jest.fn().mockResolvedValue(undefined);
      
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
        down: downFn,
      };

      // First run the migration
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      // Then rollback
      jest.clearAllMocks();
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);

      const result = await runner.rollbackLast();

      expect(result).toBe(true);
      expect(downFn).toHaveBeenCalled();
    });

    it("should return false when rolling back migration without down function", async () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
        // No down function
      };

      // Run the migration
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      // Try to rollback
      jest.clearAllMocks();
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);

      const result = await runner.rollbackLast();

      expect(result).toBe(false);
    });

    it("should reset all migration records", async () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
      };

      // Run a migration first
      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      let executed = await runner.getExecutedMigrations();
      expect(executed).toHaveLength(1);

      // Reset
      await runner.reset();

      executed = await runner.getExecutedMigrations();
      expect(executed).toHaveLength(0);
    });
  });

  describe("MigrationContext", () => {
    it("should provide prisma client and log function to migrations", async () => {
      const logMessages: string[] = [];
      
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockImplementation(async ({ prisma, log }) => {
          expect(prisma).toBeDefined();
          expect(typeof log).toBe("function");
          log("Test message");
          logMessages.push("Test message");
        }),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      expect(migration.up).toHaveBeenCalled();
      expect(logMessages).toContain("Test message");
    });
  });

  describe("Transaction handling", () => {
    it("should run migrations inside transactions", async () => {
      const migration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: Date.now(),
        up: jest.fn().mockResolvedValue(undefined),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([migration]);
      await runner.runMigrations();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
