/**
 * PHASE 7.3: Migrate Status Values
 * 
 * This migration demonstrates enum migration - transforming old status values to new format.
 * In the final schema, we use 'state' directly with uppercase values.
 * This migration is now a no-op since data is already in the correct format.
 */

import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010007_migrate_status_values",
  name: "migrate_status_values",
  createdAt: 1711238407000, // 2024-03-24T00:00:07Z

  async up({ prisma, log }: MigrationContext) {
    // In this demo, state values are already set correctly during seed
    // In a real scenario, this would map old status values to new state values
    log.info("Status values already in correct format (DRAFT/PUBLISHED/ARCHIVED)");
    log.info("Migration complete!");
  },

  async down({ prisma, log }: MigrationContext) {
    log.info("Rollback: no changes needed");
  },
};

export default migration;
