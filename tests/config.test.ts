import * as fs from "fs";
import * as path from "path";
import { loadConfig, createSampleConfig, defaultConfig, mergeConfig } from "../src/config";

describe("Config", () => {
  const testDir = path.join(__dirname, "test-config-tmp");

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("loadConfig", () => {
    it("should return default config when no config file exists", async () => {
      const config = await loadConfig(testDir);
      
      expect(config.migrationsDir).toBe(defaultConfig.migrationsDir);
      expect(config.migrationsTable).toBe(defaultConfig.migrationsTable);
    });

    it("should load JSON config file", async () => {
      const configContent = JSON.stringify({
        migrationsDir: "./custom/migrations",
        migrationsTable: "_customMigrations",
      });
      
      fs.writeFileSync(path.join(testDir, "prisma-shift.config.json"), configContent);
      
      const config = await loadConfig(testDir);
      
      expect(config.migrationsDir).toBe("./custom/migrations");
      expect(config.migrationsTable).toBe("_customMigrations");
    });

    it("should merge user config with defaults", async () => {
      const configContent = JSON.stringify({
        migrationsDir: "./custom/migrations",
      });
      
      fs.writeFileSync(path.join(testDir, "prisma-shift.config.json"), configContent);
      
      const config = await loadConfig(testDir);
      
      expect(config.migrationsDir).toBe("./custom/migrations");
      expect(config.migrationsTable).toBe(defaultConfig.migrationsTable);
    });

    it("should throw error for invalid JSON", async () => {
      fs.writeFileSync(path.join(testDir, "prisma-shift.config.json"), "invalid json");
      
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe("createSampleConfig", () => {
    it("should create a sample config file", () => {
      const configPath = createSampleConfig(testDir);
      
      expect(fs.existsSync(configPath)).toBe(true);
      
      const content = fs.readFileSync(configPath, "utf8");
      expect(content).toContain("migrationsDir");
      expect(content).toContain("Config");
      
      // Clean up
      fs.unlinkSync(configPath);
    });

    it("should throw error if config already exists", () => {
      const configPath = createSampleConfig(testDir);
      
      expect(() => createSampleConfig(testDir)).toThrow();
      
      // Clean up
      fs.unlinkSync(configPath);
    });
  });

  describe("mergeConfig", () => {
    it("should override defaults with user values", () => {
      const merged = mergeConfig(defaultConfig, {
        migrationsDir: "./custom",
      });
      
      expect(merged.migrationsDir).toBe("./custom");
      expect(merged.migrationsTable).toBe(defaultConfig.migrationsTable);
    });

    it("should deeply merge nested objects", () => {
      const merged = mergeConfig(defaultConfig, {
        typescript: { compiler: "ts-node" },
      });
      
      expect(merged.typescript?.compiler).toBe("ts-node");
      expect(merged.typescript?.transpileOnly).toBe(defaultConfig.typescript?.transpileOnly);
    });
  });
});
