/**
 * Hook: Before Migration Backup
 * 
 * This hook creates a backup of important tables before migrations run.
 * Place this in your hooks.beforeAll or hooks.beforeEach config.
 */

import { HookContext } from "prisma-shift";

export default async function backupHook({ prisma, log }: HookContext) {
  log("Creating pre-migration backup...");

  // Create backup tables for critical data
  const tablesToBackup = ["Post", "User", "PostStats"];

  for (const tableName of tablesToBackup) {
    const backupTableName = `${tableName}_backup_${Date.now()}`;
    
    try {
      // Create backup using raw SQL
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${backupTableName}" AS SELECT * FROM "${tableName}"`
      );
      
      log(`✓ Created backup: ${backupTableName}`);
    } catch (error) {
      log(`✗ Failed to backup ${tableName}: ${error}`);
      throw error; // Fail the migration if backup fails
    }
  }

  log("Pre-migration backup complete");
}
