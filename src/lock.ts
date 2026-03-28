/**
 * Distributed locking system for preventing concurrent migrations
 */

import { PrismaClientLike } from "./types";

export interface LockConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface Lock {
  /** Acquire the lock */
  acquire(): Promise<boolean>;
  /** Release the lock */
  release(): Promise<void>;
  /** Extend the lock timeout */
  extend(additionalTime: number): Promise<boolean>;
  /** Check if lock is held by this instance */
  isHeld(): boolean;
}

/**
 * Database-based distributed lock using advisory locks (PostgreSQL)
 * or a lock table for other databases
 */
export class DatabaseLock implements Lock {
  private prisma: PrismaClientLike;
  private lockId: string;
  private config: LockConfig;
  private held: boolean = false;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    prisma: PrismaClientLike,
    lockId: string,
    config: LockConfig
  ) {
    this.prisma = prisma;
    this.lockId = lockId;
    this.config = config;
  }

  /**
   * Try to acquire the lock
   */
  async acquire(): Promise<boolean> {
    if (this.held) {
      return true;
    }

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const acquired = await this.tryAcquire();
        if (acquired) {
          this.held = true;
          this.startHeartbeat();
          return true;
        }
      } catch (error) {
        // Lock error, will retry
      }

      if (attempt < this.config.retryAttempts) {
        await sleep(this.config.retryDelay);
      }
    }

    return false;
  }

  /**
   * Try to acquire the lock once
   */
  private async tryAcquire(): Promise<boolean> {
    try {
      // Try to acquire advisory lock
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT pg_try_advisory_lock(hashtext($1)) as acquired`,
        this.lockId
      );
      
      return result[0]?.acquired === true;
    } catch {
      // Advisory locks not supported, fall back to table-based locking
      return this.tryTableLock();
    }
  }

  /**
   * Table-based lock fallback
   */
  private async tryTableLock(): Promise<boolean> {
    const lockTableName = "_dataMigrationLock";
    const expiresAt = new Date(Date.now() + this.config.timeout);

    try {
      // Ensure lock table exists
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${lockTableName}" (
          "id" TEXT PRIMARY KEY,
          "acquiredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expiresAt" TIMESTAMP NOT NULL
        )
      `);

      // Try to acquire lock
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${lockTableName}" ("id", "expiresAt") VALUES ($1, $2)
         ON CONFLICT ("id") DO UPDATE SET
           "acquiredAt" = CURRENT_TIMESTAMP,
           "expiresAt" = $2
         WHERE "${lockTableName}"."expiresAt" < CURRENT_TIMESTAMP`,
        this.lockId,
        expiresAt.toISOString()
      );

      // Check if we got the lock
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "${lockTableName}" 
         WHERE "id" = $1 AND "expiresAt" = $2`,
        this.lockId,
        expiresAt.toISOString()
      );

      return result[0]?.count === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.held) {
      return;
    }

    this.stopHeartbeat();

    try {
      // Try advisory unlock first
      await this.prisma.$queryRawUnsafe(
        `SELECT pg_advisory_unlock(hashtext($1))`,
        this.lockId
      );
    } catch {
      // Fall back to table-based unlock
      try {
        const lockTableName = "_dataMigrationLock";
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "${lockTableName}" WHERE "id" = $1`,
          this.lockId
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    this.held = false;
  }

  /**
   * Extend the lock timeout
   */
  async extend(additionalTime: number): Promise<boolean> {
    if (!this.held) {
      return false;
    }

    try {
      const newExpiresAt = new Date(Date.now() + additionalTime);
      const lockTableName = "_dataMigrationLock";
      
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${lockTableName}" SET "expiresAt" = $1 WHERE "id" = $2`,
        newExpiresAt.toISOString(),
        this.lockId
      );
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if lock is held
   */
  isHeld(): boolean {
    return this.held;
  }

  /**
   * Start heartbeat to keep lock alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    // Extend lock every 1/3 of timeout
    const interval = Math.floor(this.config.timeout / 3);
    
    this.heartbeatInterval = setInterval(async () => {
      if (this.held) {
        await this.extend(this.config.timeout);
      }
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
}

/**
 * No-op lock for when locking is disabled
 */
export class NoopLock implements Lock {
  async acquire(): Promise<boolean> {
    return true;
  }

  async release(): Promise<void> {
    // No-op
  }

  async extend(): Promise<boolean> {
    return true;
  }

  isHeld(): boolean {
    return true;
  }
}

/**
 * Create appropriate lock instance
 */
export function createLock(
  prisma: PrismaClientLike,
  lockId: string,
  config: LockConfig
): Lock {
  if (!config.enabled) {
    return new NoopLock();
  }

  return new DatabaseLock(prisma, lockId, config);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
