import {
  formatValidationResult,
} from "../src/validation";

describe("Validation", () => {
  describe("formatValidationResult", () => {
    it("should format valid result", () => {
      const result = {
        valid: true,
        errors: [] as any[],
        warnings: [] as string[],
        stats: {
          total: 5,
          duplicates: 0,
          invalid: 0,
        },
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain("✓");
      expect(formatted).toContain("All migrations are valid");
    });

    it("should format invalid result with errors", () => {
      const result = {
        valid: false,
        errors: [{ migrationId: "test", type: "syntax" as const, message: "Error 1" }],
        warnings: ["Warning 1"],
        stats: {
          total: 3,
          duplicates: 1,
          invalid: 1,
        },
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain("✗");
      expect(formatted).toContain("Error 1");
      expect(formatted).toContain("Warning 1");
    });
  });
});
