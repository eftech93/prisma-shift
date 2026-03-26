/**
 * PHASE 3.3: Setup User Profiles
 * 
 * This migration runs AFTER adding profile fields to User table.
 * It loads default settings from JSON and applies them to users.
 * Also generates avatar URLs for users without avatars.
 * 
 * Migration Sequence:
 * 3.1 Schema: Add profile fields (avatar, bio, theme, language, etc.)
 * 3.2 Generate: prisma generate
 * 3.3 Data: This migration - Setup profiles ← YOU ARE HERE
 */

import * as fs from "fs";
import * as path from "path";
import { DataMigration, MigrationContext } from "prisma-shift";

const migration: DataMigration = {
  id: "20240324010003_setup_user_profiles",
  name: "setup_user_profiles",
  createdAt: 1711238403000, // 2024-03-24T00:00:03Z

  async up({ prisma, log }: MigrationContext) {
    const dataDir = path.join(process.cwd(), "data");

    // Load default settings from JSON
    log("Loading default settings from JSON...");
    const defaultSettings = JSON.parse(
      fs.readFileSync(path.join(dataDir, "default-settings.json"), "utf8")
    );

    // Find users that need profile setup
    const users = await prisma.user.findMany({
      where: { avatar: null },
    });

    log(`Setting up profiles for ${users.length} users...`);

    for (const user of users) {
      // Generate avatar URL using DiceBear API with user ID as seed
      const avatarUrl = `${defaultSettings.defaultAvatar}?seed=${user.id}`;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: avatarUrl,
          theme: defaultSettings.theme,
          language: defaultSettings.language,
          emailNotifications: defaultSettings.emailNotifications,
          weeklyDigest: defaultSettings.weeklyDigest,
          bio: `Hello, I'm ${user.name || user.email.split("@")[0]}!`,
        },
      });
    }

    log(`Updated ${users.length} user profiles`);
    log(`Default settings applied: theme=${defaultSettings.theme}, language=${defaultSettings.language}`);
  },

  async down({ prisma, log }: MigrationContext) {
    log("Clearing user profile data...");
    
    await prisma.user.updateMany({
      data: {
        avatar: null,
        bio: null,
        theme: "light",
        language: "en",
        emailNotifications: true,
        weeklyDigest: false,
      },
    });

    log("User profiles reset");
  },
};

export default migration;
