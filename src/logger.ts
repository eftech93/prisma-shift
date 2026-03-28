/**
 * Structured logging system for Prisma Shift
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  migrationId?: string;
  meta?: Record<string, unknown>;
}

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  
  // Migration lifecycle events
  migrationStart(id: string, name: string): void;
  migrationEnd(id: string, name: string, duration: number, success: boolean): void;
  migrationError(id: string, error: Error): void;
  
  // Batch processing
  batchProgress(current: number, total: number, message?: string): void;
  
  // Lock events
  lockAcquired(timeout: number): void;
  lockReleased(): void;
  lockRetry(attempt: number, maxAttempts: number): void;
  
  // Hook events
  hookStart(name: string, type: string): void;
  hookEnd(name: string, type: string, duration: number): void;
  hookError(name: string, type: string, error: Error): void;
}

export interface LoggerOptions {
  level: LogLevel;
  progress?: boolean;
  /** Custom log handler */
  handler?: (entry: LogEntry) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private progress: boolean;
  private handler?: (entry: LogEntry) => void;
  private lastProgressLength: number = 0;

  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.progress = options.progress ?? true;
    this.handler = options.handler;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>, migrationId?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      migrationId,
      meta,
    };

    if (this.handler) {
      this.handler(entry);
      return;
    }

    const prefix = this.formatPrefix(level, migrationId);
    
    switch (level) {
      case "error":
        console.error(prefix, message);
        if (meta?.error) console.error(meta.error);
        break;
      case "warn":
        console.warn(prefix, message);
        break;
      case "debug":
        console.debug(prefix, message, meta ? JSON.stringify(meta) : "");
        break;
      default:
        console.log(prefix, message);
    }
  }

  private formatPrefix(level: LogLevel, migrationId?: string): string {
    const timestamp = new Date().toISOString().slice(11, 19);
    const levelStr = level.toUpperCase().padStart(5);
    const migrationStr = migrationId ? ` [${migrationId}]` : "";
    return `[${timestamp}] ${levelStr}${migrationStr}`;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  migrationStart(id: string, name: string): void {
    this.log("info", `Starting migration: ${name}`, undefined, id);
  }

  migrationEnd(id: string, name: string, duration: number, success: boolean): void {
    const status = success ? "✓" : "✗";
    const message = `${status} Migration ${name} completed in ${duration}ms`;
    this.log(success ? "info" : "error", message, { duration }, id);
  }

  migrationError(id: string, error: Error): void {
    this.log("error", `Migration failed: ${error.message}`, { error }, id);
  }

  batchProgress(current: number, total: number, message?: string): void {
    if (!this.progress || !this.shouldLog("info")) return;

    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
    
    const line = `  ${bar} ${percentage}% (${current}/${total})${message ? ` - ${message}` : ""}`;
    
    // Clear previous line and write new one
    if (this.lastProgressLength > 0) {
      process.stdout.write("\r" + " ".repeat(this.lastProgressLength) + "\r");
    }
    
    process.stdout.write(line);
    this.lastProgressLength = line.length;
    
    if (current >= total) {
      process.stdout.write("\n");
      this.lastProgressLength = 0;
    }
  }

  lockAcquired(timeout: number): void {
    this.log("debug", `Lock acquired (timeout: ${timeout}ms)`);
  }

  lockReleased(): void {
    this.log("debug", "Lock released");
  }

  lockRetry(attempt: number, maxAttempts: number): void {
    this.log("warn", `Lock retry ${attempt}/${maxAttempts}`);
  }

  hookStart(name: string, type: string): void {
    this.log("debug", `Running ${type} hook: ${name}`);
  }

  hookEnd(name: string, type: string, duration: number): void {
    this.log("debug", `${type} hook completed in ${duration}ms`, { duration });
  }

  hookError(name: string, type: string, error: Error): void {
    this.log("error", `${type} hook failed: ${error.message}`, { error });
  }
}

/**
 * Create a silent logger (no output)
 */
export function createSilentLogger(): Logger {
  return {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    migrationStart: () => {},
    migrationEnd: () => {},
    migrationError: () => {},
    batchProgress: () => {},
    lockAcquired: () => {},
    lockReleased: () => {},
    lockRetry: () => {},
    hookStart: () => {},
    hookEnd: () => {},
    hookError: () => {},
  };
}

/**
 * Create logger from config options
 */
export function createLogger(options: { level: LogLevel; progress?: boolean }): Logger {
  if (options.level === "silent") {
    return createSilentLogger();
  }
  
  return new ConsoleLogger({
    level: options.level,
    progress: options.progress,
  });
}
