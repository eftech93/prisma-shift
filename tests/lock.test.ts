import { DatabaseLock, NoopLock, createLock } from "../src/lock";
import { PrismaClientLike } from "../src/types";

describe("Lock", () => {
  let mockPrisma: jest.Mocked<PrismaClientLike>;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    } as any;
  });

  describe("DatabaseLock", () => {
    it("should acquire lock using advisory lock", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      const acquired = await lock.acquire();
      
      expect(acquired).toBe(true);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("pg_try_advisory_lock"),
        "test-lock"
      );
    });

    it("should release lock using advisory unlock", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      await lock.acquire();
      await lock.release();
      
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("pg_advisory_unlock"),
        "test-lock"
      );
    });

    it("should fall back to table-based lock when advisory locks not supported", async () => {
      mockPrisma.$queryRawUnsafe
        .mockRejectedValueOnce(new Error("Advisory locks not supported"))
        .mockResolvedValueOnce([{ count: 1 }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      const acquired = await lock.acquire();
      
      expect(acquired).toBe(true);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS")
      );
    });

    it("should retry lock acquisition on failure", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ acquired: false }])
        .mockResolvedValueOnce([{ acquired: false }])
        .mockResolvedValueOnce([{ acquired: true }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 10,
      });
      
      const acquired = await lock.acquire();
      
      expect(acquired).toBe(true);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    });

    it("should return false if lock cannot be acquired after retries", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: false }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 2,
        retryDelay: 10,
      });
      
      const acquired = await lock.acquire();
      
      expect(acquired).toBe(false);
    });

    it("should track if lock is held", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      expect(lock.isHeld()).toBe(false);
      await lock.acquire();
      expect(lock.isHeld()).toBe(true);
      await lock.release();
      expect(lock.isHeld()).toBe(false);
    });

    it("should extend lock timeout", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      await lock.acquire();
      const extended = await lock.extend(60000);
      
      expect(extended).toBe(true);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        expect.any(String),
        "test-lock"
      );
    });

    it("should return true if already held when acquiring", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ acquired: true }]);
      
      const lock = new DatabaseLock(mockPrisma, "test-lock", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      await lock.acquire();
      const acquiredAgain = await lock.acquire();
      
      expect(acquiredAgain).toBe(true);
    });
  });

  describe("NoopLock", () => {
    it("should always acquire successfully", async () => {
      const lock = new NoopLock();
      
      const acquired = await lock.acquire();
      
      expect(acquired).toBe(true);
    });

    it("should always report as held", () => {
      const lock = new NoopLock();
      
      expect(lock.isHeld()).toBe(true);
    });

    it("should release without error", async () => {
      const lock = new NoopLock();
      
      await lock.release();
      
      // Should not throw
    });

    it("should extend without error", async () => {
      const lock = new NoopLock();
      
      const extended = await lock.extend();
      
      expect(extended).toBe(true);
    });
  });

  describe("createLock", () => {
    it("should create DatabaseLock when enabled", () => {
      const lock = createLock(mockPrisma, "test", {
        enabled: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      expect(lock).toBeInstanceOf(DatabaseLock);
    });

    it("should create NoopLock when disabled", () => {
      const lock = createLock(mockPrisma, "test", {
        enabled: false,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 100,
      });
      
      expect(lock).toBeInstanceOf(NoopLock);
    });
  });
});
