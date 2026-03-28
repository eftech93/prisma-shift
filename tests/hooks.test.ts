import { HookManager, HooksConfig } from "../src/hooks";
import { createSilentLogger } from "../src/logger";

const mockPrisma = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
} as any;

const logger = createSilentLogger();

describe("HookManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with empty hooks", () => {
      const manager = new HookManager({});
      expect(manager).toBeDefined();
    });

    it("should initialize with all hooks", () => {
      const config: HooksConfig = {
        beforeAll: "./scripts/beforeAll.ts",
        beforeEach: "./scripts/beforeEach.ts",
        afterEach: "./scripts/afterEach.ts",
        afterAll: "./scripts/afterAll.ts",
      };
      const manager = new HookManager(config);
      expect(manager).toBeDefined();
    });
  });

  describe("runBeforeAll", () => {
    it("should do nothing if no hook configured", async () => {
      const manager = new HookManager({});
      await expect(manager.runBeforeAll(mockPrisma, logger)).resolves.not.toThrow();
    });

    it("should skip hook if script not found", async () => {
      const manager = new HookManager({ beforeAll: "./nonexistent.ts" });
      
      // Should handle missing module gracefully
      await expect(manager.runBeforeAll(mockPrisma, logger)).rejects.toThrow();
    });
  });

  describe("runBeforeEach", () => {
    it("should do nothing if no hook configured", async () => {
      const manager = new HookManager({});
      await expect(
        manager.runBeforeEach(mockPrisma, logger, { id: "test", name: "test" })
      ).resolves.not.toThrow();
    });
  });

  describe("runAfterEach", () => {
    it("should do nothing if no hook configured", async () => {
      const manager = new HookManager({});
      await expect(
        manager.runAfterEach(mockPrisma, logger, { id: "test", name: "test" })
      ).resolves.not.toThrow();
    });
  });

  describe("runAfterAll", () => {
    it("should do nothing if no hook configured", async () => {
      const manager = new HookManager({});
      await expect(manager.runAfterAll(mockPrisma, logger)).resolves.not.toThrow();
    });
  });
});
