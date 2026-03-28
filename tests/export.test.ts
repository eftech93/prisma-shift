import { exportMigrations, writeExport, formatDuration } from "../src/export";
import { MigrationRecord } from "../src/types";

describe("Export", () => {
  const mockMigrations: MigrationRecord[] = [
    {
      id: "20240325120000_test1",
      name: "test1",
      createdAt: new Date("2024-03-25T12:00:00Z"),
      executedAt: new Date("2024-03-26T10:00:00Z"),
      duration: 1500,
    },
    {
      id: "20240325130000_test2",
      name: "test2",
      createdAt: new Date("2024-03-25T13:00:00Z"),
      executedAt: new Date("2024-03-26T10:30:00Z"),
      duration: 60000,
    },
  ];

  describe("exportMigrations", () => {
    it("should export to JSON format", () => {
      const result = exportMigrations(mockMigrations, { format: "json" });
      
      const parsed = JSON.parse(result);
      expect(parsed.totalMigrations).toBe(2);
      expect(parsed.migrations).toHaveLength(2);
      expect(parsed.migrations[0].id).toBe("20240325120000_test1");
    });

    it("should export to CSV format", () => {
      const result = exportMigrations(mockMigrations, { format: "csv" });
      
      const lines = result.split("\n");
      expect(lines[0]).toContain("ID,Name,Created At");
      expect(lines[1]).toContain("20240325120000_test1");
      expect(lines[1]).toContain("test1");
    });

    it("should export to HTML format", () => {
      const result = exportMigrations(mockMigrations, { format: "html" });
      
      expect(result).toContain("<!DOCTYPE html>");
      expect(result).toContain("Migration History Report");
      expect(result).toContain("20240325120000_test1");
      expect(result).toContain("test1");
    });

    it("should throw error for unsupported format", () => {
      expect(() => {
        exportMigrations(mockMigrations, { format: "xml" as any });
      }).toThrow("Unsupported export format");
    });

    it("should include formatted duration", () => {
      const result = exportMigrations(mockMigrations, { format: "json" });
      
      const parsed = JSON.parse(result);
      expect(parsed.migrations[0].durationFormatted).toBeDefined();
      expect(parsed.migrations[0].durationFormatted).toBe("1s");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(5000)).toBe("5s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(125000)).toBe("2m 5s");
    });

    it("should format hours and minutes", () => {
      expect(formatDuration(7260000)).toBe("2h 1m");
    });
  });

  describe("writeExport", () => {
    it("should return content when no output path specified", () => {
      const result = writeExport(mockMigrations, { format: "json" });
      
      expect(typeof result).toBe("string");
      expect(JSON.parse(result).totalMigrations).toBe(2);
    });

    it("should write to file when output path specified", () => {
      const fs = require("fs");
      const writeFileSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      
      writeExport(mockMigrations, { format: "json", output: "/tmp/export.json" });
      
      expect(writeFileSpy).toHaveBeenCalledWith(
        "/tmp/export.json",
        expect.any(String),
        "utf8"
      );
      
      writeFileSpy.mockRestore();
    });
  });
});
