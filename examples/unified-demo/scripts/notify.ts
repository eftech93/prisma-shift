/**
 * Hook: After Migration Notification
 * 
 * This hook sends a notification after migrations complete.
 * Place this in your hooks.afterAll config.
 */

import { HookContext } from "prisma-shift";

export default async function notifyHook({ prisma, log }: HookContext) {
  log("Sending migration completion notification...");

  // Get migration stats
  const executedMigrations = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM "_dataMigration"`
  );

  const migrationCount = executedMigrations[0]?.count || 0;

  // In production, you might send to Slack, email, etc.
  // For demo, we just log
  log("========================================");
  log("📧 Migration Notification");
  log("========================================");
  log(`Status: ✅ COMPLETE`);
  log(`Total migrations executed: ${migrationCount}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  log("========================================");

  // Example: Send to webhook (commented out for demo)
  // await fetch('https://hooks.slack.com/services/...', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     text: `Migrations complete! ${migrationCount} total migrations.`,
  //   }),
  // });
}
