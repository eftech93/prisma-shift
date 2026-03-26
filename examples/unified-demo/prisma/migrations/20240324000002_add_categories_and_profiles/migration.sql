-- PHASE 2 & 3: Categories and User Profiles
-- Adds Category table, category relation to Post, and user profile fields

-- Create Category table
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#000000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Create unique index on category name
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- Add categoryId to Post
ALTER TABLE "Post" ADD COLUMN "categoryId" TEXT;

-- Add index on categoryId
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- Add foreign key from Post to Category
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add profile fields to User
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "postCount" INTEGER NOT NULL DEFAULT 0;
