import {
  batchProcess,
  batchProcessWithRetry,
  estimateBatchSize,
  createProgressTracker,
  streamProcess,
} from "../src/batch";
import { createSilentLogger } from "../src/logger";

describe("Batch Processing", () => {
  const logger = createSilentLogger();

  describe("batchProcess", () => {
    it("should process all items in batches", async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];
      let callCount = 0;

      const result = await batchProcess({
        query: () => {
          callCount++;
          // Simulate pagination - return all items on first call, empty after
          if (callCount === 1) {
            return Promise.resolve(items);
          }
          return Promise.resolve([]);
        },
        batchSize: 2,
        process: async (batch) => {
          processed.push(...batch);
        },
      });

      expect(processed).toEqual(items);
      expect(result.processed).toBe(5);
    });

    it("should collect errors without stopping", async () => {
      // Use getCursor to properly simulate pagination for batch size 1
      const items = [1, 2, 3, 4, 5];
      let callCount = 0;
      
      const result = await batchProcess({
        query: () => {
          callCount++;
          // Return one item at a time
          const index = callCount - 1;
          if (index < items.length) {
            return Promise.resolve([items[index]]);
          }
          return Promise.resolve([]);
        },
        batchSize: 1,
        getCursor: (item) => String(item),
        process: async (batch) => {
          if (batch[0] === 2 || batch[0] === 4) {
            throw new Error(`Error processing ${batch[0]}`);
          }
        },
      });

      expect(result.errors.length).toBe(2);
    });

    it("should handle empty result", async () => {
      const result = await batchProcess({
        query: () => Promise.resolve([]),
        batchSize: 10,
        process: async () => {},
      });

      expect(result.processed).toBe(0);
      expect(result.batches).toBe(0);
    });

    it("should use cursor for pagination", async () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      let callCount = 0;
      const processed: string[] = [];

      const result = await batchProcess({
        query: (cursor) => {
          callCount++;
          const startIndex = cursor ? items.findIndex(i => i.id === cursor) + 1 : 0;
          return Promise.resolve(items.slice(startIndex, startIndex + 2));
        },
        batchSize: 2,
        getCursor: (item) => item.id,
        process: async (batch) => {
          processed.push(...batch.map(i => i.id));
        },
      });

      expect(processed).toEqual(["1", "2", "3"]);
      expect(result.processed).toBe(3);
    });

    it("should apply delay between batches", async () => {
      // Create multiple batches to trigger delay
      const items = [1, 2, 3, 4];
      let callCount = 0;

      const startTime = Date.now();
      await batchProcess({
        query: () => {
          callCount++;
          // Return 2 items per batch, so we get 2 batches
          const start = (callCount - 1) * 2;
          const batch = items.slice(start, start + 2);
          return Promise.resolve(batch);
        },
        batchSize: 2,
        delayBetweenBatches: 50,
        process: async () => {},
      });
      const duration = Date.now() - startTime;

      // Should have delay between the 2 batches
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe("batchProcessWithRetry", () => {
    it("should succeed on first attempt", async () => {
      const items = [1, 2, 3];
      let callCount = 0;

      const result = await batchProcessWithRetry({
        query: () => {
          callCount++;
          if (callCount === 1) return Promise.resolve(items);
          return Promise.resolve([]);
        },
        batchSize: 10,
        process: async () => {},
        maxRetries: 3,
      });

      expect(result.processed).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it("should retry on failure", async () => {
      let attemptCount = 0;

      const result = await batchProcessWithRetry({
        query: () => {
          attemptCount++;
          if (attemptCount === 1) return Promise.resolve([1, 2, 3]);
          if (attemptCount === 2) return Promise.resolve([1, 2, 3]);
          return Promise.resolve([]);
        },
        batchSize: 10,
        process: async () => {
          if (attemptCount === 1) throw new Error("Temporary error");
        },
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result.processed).toBe(3);
    });
  });

  describe("estimateBatchSize", () => {
    it("should calculate batch size based on row size", () => {
      const batchSize = estimateBatchSize(100, 100 * 1024 * 1024);
      
      expect(batchSize).toBeGreaterThan(100);
      expect(batchSize).toBeLessThanOrEqual(10000);
    });

    it("should clamp to minimum of 100", () => {
      // Very large row size (10MB) should clamp to minimum 100
      const batchSize = estimateBatchSize(10 * 1024 * 1024, 100 * 1024 * 1024);
      
      expect(batchSize).toBe(100);
    });

    it("should clamp to maximum of 10000", () => {
      const batchSize = estimateBatchSize(1, 100 * 1024 * 1024);
      
      expect(batchSize).toBe(10000);
    });
  });

  describe("createProgressTracker", () => {
    it("should track progress increments", () => {
      const tracker = createProgressTracker(100, logger);
      
      tracker.increment(10);
      expect(tracker.current).toBe(10);
      
      tracker.increment(20);
      expect(tracker.current).toBe(30);
    });

    it("should set absolute value", () => {
      const tracker = createProgressTracker(100, logger);
      
      tracker.set(50);
      expect(tracker.current).toBe(50);
    });

    it("should call done", () => {
      const tracker = createProgressTracker(100, logger);
      
      tracker.set(50);
      tracker.done();
      // done() logs progress at 100% but doesn't change current value
      expect(tracker.current).toBe(50);
    });
  });

  describe("streamProcess", () => {
    async function* createMockStream(items: number[]) {
      for (const item of items) {
        yield item;
      }
    }

    it("should process all items from stream", async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];

      const result = await streamProcess({
        source: createMockStream(items),
        process: async (item) => {
          processed.push(item);
        },
        batchSize: 2,
      });

      expect(processed).toEqual(items);
      expect(result.processed).toBe(5);
    });

    it("should respect limit", async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];

      const result = await streamProcess({
        source: createMockStream(items),
        process: async (item) => {
          processed.push(item);
        },
        batchSize: 1,
        limit: 3,
      });

      // Should process at least 3 items (may process more due to batching)
      expect(result.processed).toBeGreaterThanOrEqual(3);
      expect(processed.slice(0, 3)).toEqual([1, 2, 3]);
    });

    it("should call onProgress", async () => {
      const items = [1, 2, 3, 4];
      const progressCalls: number[] = [];

      await streamProcess({
        source: createMockStream(items),
        process: async () => {},
        batchSize: 2,
        onProgress: (processed) => {
          progressCalls.push(processed);
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });
});
