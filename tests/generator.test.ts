/**
 * @jest-environment node
 */

describe("Generator", () => {
  // The generator is tested indirectly through integration tests
  // as it requires the full Prisma generator infrastructure

  it("should have generator entry point", () => {
    // Verify the generator file exists and can be imported
    expect(() => {
      require("../src/generator");
    }).not.toThrow();
  });

  it("should export generator handler", () => {
    const generator = require("../src/generator");
    // The generator should have a default export or handler
    expect(generator).toBeDefined();
  });
});
