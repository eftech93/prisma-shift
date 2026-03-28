/**
 * Batch processing utilities for large dataset migrations
 */

import { Logger } from "./logger";

export interface BatchOptions<T> {
  /** Query function to fetch items */
  query: (cursor?: string | null) => Promise<T[]>;
  /** Batch size */
  batchSize?: number;
  /** Process function for each batch */
  process: (items: T[]) => Promise<void>;
  /** Progress callback */
  onProgress?: (processed: number, total?: number) => void;
  /** Get ID from item for cursor pagination */
  getCursor?: (item: T) => string;
  /** Total count (if known) for progress calculation */
  totalCount?: number;
  /** Delay between batches in milliseconds */
  delayBetweenBatches?: number;
}

export interface BatchResult {
  processed: number;
  batches: number;
  duration: number;
  errors: Array<{ batch: number; error: Error }>;
}

/**
 * Process large datasets in batches
 */
export async function batchProcess<T>(
  options: BatchOptions<T>,
  log?: Logger
): Promise<BatchResult> {
  const {
    query,
    batchSize = 1000,
    process,
    onProgress,
    getCursor,
    totalCount,
    delayBetweenBatches = 0,
  } = options;

  const startTime = Date.now();
  let processed = 0;
  let batches = 0;
  let cursor: string | null | undefined = undefined;
  const errors: Array<{ batch: number; error: Error }> = [];

  while (true) {
    const items = await query(cursor);
    
    if (items.length === 0) {
      break;
    }

    batches++;

    try {
      await process(items);
      processed += items.length;

      if (log) {
        log.batchProgress(processed, totalCount ?? processed + batchSize);
      }

      if (onProgress) {
        onProgress(processed, totalCount);
      }
    } catch (error) {
      errors.push({ batch: batches, error: error as Error });
      
      if (log) {
        log.error(`Batch ${batches} failed: ${(error as Error).message}`);
      }
    }

    // Update cursor for next batch
    if (getCursor && items.length > 0) {
      cursor = getCursor(items[items.length - 1]);
    } else if (!getCursor && items.length < batchSize) {
      // No cursor function and we got fewer items than batch size
      break;
    }

    // Delay between batches if configured
    if (delayBetweenBatches > 0) {
      await sleep(delayBetweenBatches);
    }
  }

  // Clear progress line
  if (log) {
    log.batchProgress(processed, processed);
  }

  return {
    processed,
    batches,
    duration: Date.now() - startTime,
    errors,
  };
}

/**
 * Process with automatic retry
 */
export async function batchProcessWithRetry<T>(
  options: BatchOptions<T> & { maxRetries?: number; retryDelay?: number },
  log?: Logger
): Promise<BatchResult> {
  const { maxRetries = 3, retryDelay = 1000, ...batchOptions } = options;

  let lastResult: BatchResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResult = await batchProcess(batchOptions, log);

    if (lastResult.errors.length === 0) {
      return lastResult;
    }

    if (attempt < maxRetries) {
      log?.warn(`Batch processing failed, retrying ${attempt}/${maxRetries}...`);
      await sleep(retryDelay * attempt);
    }
  }

  return lastResult!;
}

/**
 * Calculate optimal batch size based on memory usage
 */
export function estimateBatchSize(
  estimatedRowSize: number, // in bytes
  maxMemoryUsage: number = 100 * 1024 * 1024 // 100MB default
): number {
  const targetBatchSize = Math.floor(maxMemoryUsage / estimatedRowSize);
  
  // Clamp between reasonable values
  return Math.max(100, Math.min(10000, targetBatchSize));
}

/**
 * Create a progress tracker for manual progress updates
 */
export function createProgressTracker(
  total: number,
  log?: Logger,
  onProgress?: (current: number, total: number) => void
) {
  let current = 0;

  return {
    increment(amount: number = 1) {
      current += amount;
      
      if (log) {
        log.batchProgress(current, total);
      }
      
      if (onProgress) {
        onProgress(current, total);
      }
    },
    
    set(value: number) {
      current = value;
      
      if (log) {
        log.batchProgress(current, total);
      }
      
      if (onProgress) {
        onProgress(current, total);
      }
    },
    
    get current() {
      return current;
    },
    
    done() {
      if (log) {
        log.batchProgress(total, total);
      }
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stream processing for very large datasets
 */
export interface StreamOptions<T> {
  /** Async iterator or generator */
  source: AsyncIterable<T>;
  /** Process function for each item */
  process: (item: T) => Promise<void>;
  /** Batch size for processing */
  batchSize?: number;
  /** Progress callback */
  onProgress?: (processed: number) => void;
  /** Maximum items to process (0 = unlimited) */
  limit?: number;
}

export async function streamProcess<T>(
  options: StreamOptions<T>,
  log?: Logger
): Promise<{ processed: number; duration: number }> {
  const { source, process, batchSize = 100, onProgress, limit = 0 } = options;

  const startTime = Date.now();
  let processed = 0;
  let batch: T[] = [];

  for await (const item of source) {
    batch.push(item);

    if (batch.length >= batchSize) {
      await processBatch(batch, process);
      processed += batch.length;
      
      if (log) {
        log.batchProgress(processed, limit || processed + batchSize);
      }
      
      if (onProgress) {
        onProgress(processed);
      }

      batch = [];

      if (limit > 0 && processed >= limit) {
        break;
      }
    }
  }

  // Process remaining items
  if (batch.length > 0) {
    await processBatch(batch, process);
    processed += batch.length;
  }

  return {
    processed,
    duration: Date.now() - startTime,
  };
}

async function processBatch<T>(
  batch: T[],
  process: (item: T) => Promise<void>
): Promise<void> {
  await Promise.all(batch.map((item) => process(item)));
}
