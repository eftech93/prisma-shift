// Main exports
export * from "./types";
export * from "./utils";
export * from "./migration-runner";
export { 
  createMigrationExtension, 
  withDataMigrations, 
  createPrismaClientWithMigrations 
} from "./extension";

// Default export for convenience
export { createPrismaClientWithMigrations as default } from "./extension";
