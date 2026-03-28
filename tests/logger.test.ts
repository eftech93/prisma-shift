import { ConsoleLogger, createLogger, createSilentLogger, LogLevel } from "../src/logger";

describe("Logger", () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("ConsoleLogger", () => {
    it("should log messages at or above configured level", () => {
      const logger = new ConsoleLogger({ level: "info" });
      
      logger.info("info message");
      logger.debug("debug message");
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("should not log when level is silent", () => {
      const logger = new ConsoleLogger({ level: "silent" });
      
      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should log errors with stack trace", () => {
      const logger = new ConsoleLogger({ level: "error" });
      const error = new Error("Test error");
      
      logger.error("Error occurred", { error });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should track migration start", () => {
      const logger = new ConsoleLogger({ level: "info" });
      
      logger.migrationStart("20240325_test", "test migration");
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should track migration end with success", () => {
      const logger = new ConsoleLogger({ level: "info" });
      
      logger.migrationEnd("20240325_test", "test migration", 1500, true);
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should track migration end with failure", () => {
      const logger = new ConsoleLogger({ level: "info" });
      
      logger.migrationEnd("20240325_test", "test migration", 1500, false);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should track migration errors", () => {
      const logger = new ConsoleLogger({ level: "error" });
      const error = new Error("Migration failed");
      
      logger.migrationError("20240325_test", error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should display batch progress", () => {
      const stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = new ConsoleLogger({ level: "info", progress: true });
      
      logger.batchProgress(50, 100);
      
      expect(stdoutWriteSpy).toHaveBeenCalled();
      
      stdoutWriteSpy.mockRestore();
    });

    it("should not display progress when progress is disabled", () => {
      const stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = new ConsoleLogger({ level: "info", progress: false });
      
      logger.batchProgress(50, 100);
      
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
      
      stdoutWriteSpy.mockRestore();
    });

    it("should track lock events", () => {
      const logger = new ConsoleLogger({ level: "debug" });
      
      logger.lockAcquired(30000);
      logger.lockReleased();
      logger.lockRetry(1, 3);
      
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it("should track hook events", () => {
      const logger = new ConsoleLogger({ level: "debug" });
      
      logger.hookStart("backup.ts", "beforeAll");
      logger.hookEnd("backup.ts", "beforeAll", 500);
      logger.hookError("backup.ts", "beforeAll", new Error("Failed"));
      
      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe("createLogger", () => {
    it("should create ConsoleLogger for non-silent levels", () => {
      const logger = createLogger({ level: "info" });
      
      logger.info("test");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should create SilentLogger for silent level", () => {
      const logger = createLogger({ level: "silent" });
      
      logger.info("test");
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("createSilentLogger", () => {
    it("should not output anything", () => {
      const logger = createSilentLogger();
      
      logger.error("error");
      logger.warn("warn");
      logger.info("info");
      logger.debug("debug");
      logger.migrationStart("id", "name");
      logger.migrationEnd("id", "name", 100, true);
      logger.batchProgress(50, 100);
      
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
