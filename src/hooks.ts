/**
 * Lifecycle hooks for migrations
 */

import * as path from "path";
import { PrismaClientLike } from "./types";
import { Logger } from "./logger";

export interface HookContext {
  prisma: PrismaClientLike;
  log: Logger;
  migration?: {
    id: string;
    name: string;
  };
}

export type HookFn = (context: HookContext) => Promise<void> | void;

export interface HooksConfig {
  beforeAll?: string;
  afterAll?: string;
  beforeEach?: string;
  afterEach?: string;
}

export class HookManager {
  private hooks: HooksConfig;
  private cwd: string;

  constructor(hooks: HooksConfig, cwd: string = process.cwd()) {
    this.hooks = hooks;
    this.cwd = cwd;
  }

  /**
   * Run beforeAll hook
   */
  async runBeforeAll(prisma: PrismaClientLike, log: Logger): Promise<void> {
    await this.runHook("beforeAll", this.hooks.beforeAll, { prisma, log });
  }

  /**
   * Run afterAll hook
   */
  async runAfterAll(prisma: PrismaClientLike, log: Logger): Promise<void> {
    await this.runHook("afterAll", this.hooks.afterAll, { prisma, log });
  }

  /**
   * Run beforeEach hook
   */
  async runBeforeEach(
    prisma: PrismaClientLike,
    log: Logger,
    migration: { id: string; name: string }
  ): Promise<void> {
    await this.runHook("beforeEach", this.hooks.beforeEach, {
      prisma,
      log,
      migration,
    });
  }

  /**
   * Run afterEach hook
   */
  async runAfterEach(
    prisma: PrismaClientLike,
    log: Logger,
    migration: { id: string; name: string }
  ): Promise<void> {
    await this.runHook("afterEach", this.hooks.afterEach, {
      prisma,
      log,
      migration,
    });
  }

  /**
   * Run a hook from file path
   */
  private async runHook(
    type: string,
    hookPath: string | undefined,
    context: HookContext
  ): Promise<void> {
    if (!hookPath) {
      return;
    }

    const startTime = Date.now();
    const fullPath = path.resolve(this.cwd, hookPath);

    try {
      context.log.hookStart(hookPath, type);

      // Clear require cache to allow reloading
      delete require.cache[require.resolve(fullPath)];

      const module = await import(fullPath);
      const hook: HookFn = module.default || module;

      if (typeof hook !== "function") {
        throw new Error(`Hook at ${hookPath} must export a function`);
      }

      await hook(context);

      const duration = Date.now() - startTime;
      context.log.hookEnd(hookPath, type, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      context.log.hookError(hookPath, type, error as Error);
      throw new Error(`Hook "${type}" failed: ${(error as Error).message}`);
    }
  }
}

/**
 * Built-in hook utilities
 */
export const hookUtils = {
  /**
   * Create a backup of a table before migration
   */
  async backupTable(
    prisma: PrismaClientLike,
    tableName: string,
    backupSuffix: string = "_backup"
  ): Promise<void> {
    const backupTableName = `${tableName}${backupSuffix}_${Date.now()}`;
    
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${backupTableName}" AS SELECT * FROM "${tableName}"`
    );
  },

  /**
   * Send notification (webhook, slack, etc.)
   */
  async sendWebhook(url: string, payload: unknown): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  },

  /**
   * Check if running in CI environment
   */
  isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.TRAVIS ||
      process.env.CIRCLECI
    );
  },

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
