import { MigrationRunner } from "../src/migration-runner";
import { DataMigration, PrismaClientLike } from "../src/types";

jest.mock("../src/utils", () => ({
  loadMigrations: jest.fn(),
}));

import { loadMigrations } from "../src/utils";

describe("MigrationRunner squash", () => {
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

  it("should return error if pending migrations exist in range", async () => {
    const mockMigrations: DataMigration[] = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: 1,
        up: jest.fn(),
      },
      {
        id: "20240302000000_second",
        name: "second",
        createdAt: 2,
        up: jest.fn(),
      },
    ];

    const mockExecuted = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: new Date(),
        executedAt: new Date(),
        duration: 100,
      },
    ];

    (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);
    (mockPrisma.$queryRawUnsafe as jest.Mock)
      .mockResolvedValueOnce([]) // ensureMigrationsTable
      .mockResolvedValueOnce(mockExecuted);

    const result = await runner.squash(
      { from: "20240301", to: "20240331" },
      "20240331000000_squashed",
      "squashed"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("pending");
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("should squash executed migrations and update records", async () => {
    const mockMigrations: DataMigration[] = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: 1,
        up: jest.fn(),
      },
      {
        id: "20240302000000_second",
        name: "second",
        createdAt: 2,
        up: jest.fn(),
      },
    ];

    const mockExecuted = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: new Date("2024-03-01"),
        executedAt: new Date("2024-03-01"),
        duration: 100,
      },
      {
        id: "20240302000000_second",
        name: "second",
        createdAt: new Date("2024-03-02"),
        executedAt: new Date("2024-03-02"),
        duration: 200,
      },
    ];

    (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);
    (mockPrisma.$queryRawUnsafe as jest.Mock)
      .mockResolvedValueOnce([]) // ensureMigrationsTable
      .mockResolvedValueOnce(mockExecuted);

    const result = await runner.squash(
      { from: "20240301", to: "20240331" },
      "20240331000000_squashed",
      "squashed"
    );

    expect(result.success).toBe(true);
    expect(result.removedRecords).toBe(2);
    expect(result.addedRecord).toBe(true);
    expect(result.updatedRecord).toBe(false);

    // Verify DELETE was called
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("DELETE"),
      "20240301000000_first",
      "20240302000000_second"
    );

    // Verify INSERT was called
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("INSERT"),
      "20240331000000_squashed",
      "squashed",
      expect.any(String),
      expect.any(String),
      300
    );
  });

  it("should update existing record if squashed migration already exists", async () => {
    const mockMigrations: DataMigration[] = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: 1,
        up: jest.fn(),
      },
    ];

    const mockExecuted = [
      {
        id: "20240301000000_first",
        name: "first",
        createdAt: new Date(),
        executedAt: new Date(),
        duration: 100,
      },
      {
        id: "20240331000000_squashed",
        name: "old_name",
        createdAt: new Date(),
        executedAt: new Date(),
        duration: 50,
      },
    ];

    (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);
    (mockPrisma.$queryRawUnsafe as jest.Mock)
      .mockResolvedValueOnce([]) // ensureMigrationsTable
      .mockResolvedValueOnce(mockExecuted);

    const result = await runner.squash(
      { from: "20240301", to: "20240331" },
      "20240331000000_squashed",
      "squashed"
    );

    expect(result.success).toBe(true);
    expect(result.removedRecords).toBe(1);
    expect(result.addedRecord).toBe(false);
    expect(result.updatedRecord).toBe(true);

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE"),
      "squashed",
      100,
      "20240331000000_squashed"
    );
  });

  it("should return success with no changes when range has no executed migrations", async () => {
    const mockMigrations: DataMigration[] = [];
    const mockExecuted: any[] = [];

    (loadMigrations as jest.Mock).mockResolvedValue(mockMigrations);
    (mockPrisma.$queryRawUnsafe as jest.Mock)
      .mockResolvedValueOnce([]) // ensureMigrationsTable
      .mockResolvedValueOnce(mockExecuted);

    const result = await runner.squash(
      { from: "20240301", to: "20240331" },
      "20240331000000_squashed",
      "squashed"
    );

    expect(result.success).toBe(true);
    expect(result.removedRecords).toBe(0);
    expect(result.addedRecord).toBe(false);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
