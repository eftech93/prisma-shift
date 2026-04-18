// Main exports
export * from "./types";
export * from "./utils";
export * from "./migration-runner";
export * from "./config";
export * from "./logger";
export * from "./lock";
export * from "./hooks";
export * from "./batch";
export * from "./validation";
export * from "./export";
export * from "./squash";

// Extension exports
export {
  createMigrationExtension,
  withDataMigrations,
  createPrismaClientWithMigrations,
} from "./extension";

// Default export for convenience
export { createPrismaClientWithMigrations as default } from "./extension";
