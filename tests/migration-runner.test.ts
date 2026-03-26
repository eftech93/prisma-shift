import { MigrationRunner } from "../src/migration-runner";
import { DataMigration, PrismaClientLike } from "../src/types";

// Mock dependencies
jest.mock("../src/utils", () => ({
  loadMigrations: jest.fn(),
}));

import { loadMigrations } from "../src/utils";

describe("MigrationRunner", () => {
  let mockPrisma: jest.Mocked<PrismaClientLike>;
  let runner: MigrationRunner;

  beforeEach(() => {
    jest.resetAllMocks();

    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
      $transaction: jest.fn((fn) => fn(mockPrisma)),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    } as unknown as jest.Mocked<PrismaClientLike>;

    runner = new MigrationRunner(mockPrisma, {
      migrationsDir: "./migrations",
      migrationsTable: "_dataMigration",
    });
  });

  describe("ensureMigrationsTable", () => {
    it("should create table if it does not exist", async () => {
      // First query throws (table doesn't exist)
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockRejectedValueOnce(new Error("Table not found"));

      await runner.ensureMigrationsTable();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "_dataMigration"')
      );
    });

    it("should not create table if it already exists", async () => {
      // First query succeeds (table exists)
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]);

      await runner.ensureMigrationsTable();

      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE')
      );
    });
  });

  describe("getExecutedMigrations", () => {
    it("should return executed migrations", async () => {
      const mockRecords = [
        {
          id: "20240324120000_test",
          name: "test",
          createdAt: new Date(),
          executedAt: new Date(),
          duration: 1000,
        },
      ];

      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable query
        .mockResolvedValueOnce(mockRecords);

      const result = await runner.getExecutedMigrations();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("20240324120000_test");
    });

    it("should return empty array if no migrations", async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable query
        .mockResolvedValueOnce([]);

      const result = await runner.getExecutedMigrations();

      expect(result).toEqual([]);
    });
  });

  describe("getStatus", () => {
    it("should return correct status with pending and executed migrations", async () => {
      const mockMigrations: DataMigration[] = [
        {
          id: "20240324110000_first",
          name: "first",
          createdAt: 1711281600000,
          up: jest.fn(),
        },
        {
          id: "20240324120000_second",
          name: "second",
          createdAt: 1711285200000,
          up: jest.fn(),
        },
      ];

      const mockExecuted = [
        {
          id: "20240324110000_first",
          name: "first",
          createdAt: new Date(),
          executedAt: new Date(),
          duration: 1000,
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce(mockExecuted);

      const status = await runner.getStatus();

      expect(status.executed).toHaveLength(1);
      expect(status.pending).toHaveLength(1);
      expect(status.pending[0].id).toBe("20240324120000_second");
      expect(status.all).toHaveLength(2);
    });
  });

  describe("runMigrations", () => {
    it("should execute pending migrations", async () => {
      const mockMigration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: 1711285200000,
        up: jest.fn().mockResolvedValue(undefined),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([mockMigration]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce([]); // No executed migrations

      const result = await runner.runMigrations();

      expect(result.success).toBe(true);
      expect(result.executedMigrations).toContain("20240324120000_test");
      expect(mockMigration.up).toHaveBeenCalled();
    });

    it("should stop on first failure", async () => {
      const mockMigration1: DataMigration = {
        id: "20240324110000_first",
        name: "first",
        createdAt: 1711281600000,
        up: jest.fn().mockResolvedValue(undefined),
      };

      const mockMigration2: DataMigration = {
        id: "20240324120000_second",
        name: "second",
        createdAt: 1711285200000,
        up: jest.fn().mockRejectedValue(new Error("Migration failed")),
      };

      (loadMigrations as jest.Mock).mockResolvedValue([mockMigration1, mockMigration2]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce([]); // No executed migrations

      const result = await runner.runMigrations();

      expect(result.success).toBe(false);
      expect(result.failedMigration).toBe("20240324120000_second");
      expect(result.executedMigrations).toContain("20240324110000_first");
      expect(result.error).toBeDefined();
    });

    it("should return success if no pending migrations", async () => {
      (loadMigrations as jest.Mock).mockResolvedValue([]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce([]); // No executed migrations

      const result = await runner.runMigrations();

      expect(result.success).toBe(true);
      expect(result.executedMigrations).toHaveLength(0);
    });
  });

  describe("rollbackLast", () => {
    it("should rollback the last executed migration", async () => {
      const mockMigration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: 1711285200000,
        up: jest.fn(),
        down: jest.fn().mockResolvedValue(undefined),
      };

      const mockExecuted = [
        {
          id: "20240324110000_first",
          name: "first",
          createdAt: new Date(),
          executedAt: new Date(),
          duration: 1000,
        },
        {
          id: "20240324120000_test",
          name: "test",
          createdAt: new Date(),
          executedAt: new Date(),
          duration: 1000,
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue([mockMigration]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce(mockExecuted);

      const result = await runner.rollbackLast();

      expect(result).toBe(true);
      expect(mockMigration.down).toHaveBeenCalled();
    });

    it("should return false if no migrations to rollback", async () => {
      // Setup: empty migrations table and no migration files
      (loadMigrations as jest.Mock).mockResolvedValue([]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce([]); // No executed migrations

      const result = await runner.rollbackLast();

      expect(result).toBe(false);
    });

    it("should return false if migration has no down function", async () => {
      const mockMigration: DataMigration = {
        id: "20240324120000_test",
        name: "test",
        createdAt: 1711285200000,
        up: jest.fn(),
        // No down function
      };

      const mockExecuted = [
        {
          id: "20240324120000_test",
          name: "test",
          createdAt: new Date(),
          executedAt: new Date(),
          duration: 1000,
        },
      ];

      (loadMigrations as jest.Mock).mockResolvedValue([mockMigration]);
      (mockPrisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // ensureMigrationsTable
        .mockResolvedValueOnce(mockExecuted);

      const result = await runner.rollbackLast();

      expect(result).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear all migration records", async () => {
      await runner.reset();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'DELETE FROM "_dataMigration"'
      );
    });
  });
});
