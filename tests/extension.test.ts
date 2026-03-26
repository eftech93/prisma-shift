/**
 * @jest-environment node
 */

import { withDataMigrations } from "../src/extension";
import { MigrationRunner } from "../src/migration-runner";

jest.mock("../src/migration-runner");

describe("Extension", () => {
  let mockPrisma: any;
  let mockRunner: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockRunner = {
      runMigrations: jest.fn().mockResolvedValue({ success: true, executedMigrations: [] }),
      getStatus: jest.fn().mockResolvedValue({ pending: [], executed: [], all: [] }),
      rollbackLast: jest.fn().mockResolvedValue(true),
      reset: jest.fn().mockResolvedValue(undefined),
    };

    (MigrationRunner as jest.MockedClass<typeof MigrationRunner>).mockImplementation(
      () => mockRunner
    );

    mockPrisma = {
      $extends: jest.fn().mockReturnValue({
        $dataMigrations: {
          run: jest.fn(),
          status: jest.fn(),
          rollback: jest.fn(),
          reset: jest.fn(),
        },
      }),
    };
  });

  describe("withDataMigrations", () => {
    it("should extend prisma client", () => {
      const extended = withDataMigrations(mockPrisma, {
        migrationsDir: "./migrations",
      });

      expect(mockPrisma.$extends).toHaveBeenCalled();
      expect(extended.$dataMigrations).toBeDefined();
    });

    it("should pass a function to $extends", () => {
      withDataMigrations(mockPrisma, {
        migrationsDir: "./custom-migrations",
        migrationsTable: "_customMigrations",
      });

      expect(mockPrisma.$extends).toHaveBeenCalled();
      const extendArg = mockPrisma.$extends.mock.calls[0][0];
      expect(typeof extendArg).toBe("function");
    });
  });

  describe("extension client methods", () => {
    it("should expose $dataMigrations methods on extended client", async () => {
      const extendedClient = {
        $dataMigrations: {
          run: jest.fn(),
          status: jest.fn(),
          rollback: jest.fn(),
          reset: jest.fn(),
        },
      };
      
      mockPrisma.$extends.mockReturnValue(extendedClient);

      const extended = withDataMigrations(mockPrisma, {
        migrationsDir: "./migrations",
      });
      
      expect(extended.$dataMigrations).toBeDefined();
      expect(typeof extended.$dataMigrations.run).toBe("function");
      expect(typeof extended.$dataMigrations.status).toBe("function");
      expect(typeof extended.$dataMigrations.rollback).toBe("function");
      expect(typeof extended.$dataMigrations.reset).toBe("function");
    });

    it("should call MigrationRunner methods through extension", async () => {
      const extendedClient = {
        $dataMigrations: {
          run: jest.fn().mockImplementation(() => mockRunner.runMigrations()),
          status: jest.fn().mockImplementation(() => mockRunner.getStatus()),
          rollback: jest.fn().mockImplementation(() => mockRunner.rollbackLast()),
          reset: jest.fn().mockImplementation(() => mockRunner.reset()),
        },
      };
      
      mockPrisma.$extends.mockReturnValue(extendedClient);

      const extended = withDataMigrations(mockPrisma, {
        migrationsDir: "./migrations",
      });

      // Test run
      await extended.$dataMigrations.run();
      expect(mockRunner.runMigrations).toHaveBeenCalled();

      // Test status
      await extended.$dataMigrations.status();
      expect(mockRunner.getStatus).toHaveBeenCalled();

      // Test rollback
      await extended.$dataMigrations.rollback();
      expect(mockRunner.rollbackLast).toHaveBeenCalled();

      // Test reset
      await extended.$dataMigrations.reset();
      expect(mockRunner.reset).toHaveBeenCalled();
    });
  });
});
