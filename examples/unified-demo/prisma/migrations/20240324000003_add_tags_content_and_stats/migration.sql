-- PHASE 4, 5, 6 & 7: Tags, Content Fields, Stats, and Status Refactor
-- Adds Tag tables, content fields, soft delete, stats table, and new status fields

-- Create Tag table
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- Create PostTag join table (many-to-many)
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId", "tagId")
);

CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add soft delete fields to Post
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- Add content fields to Post
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;
ALTER TABLE "Post" ADD COLUMN "excerpt" TEXT;
ALTER TABLE "Post" ADD COLUMN "readingTime" INTEGER;

CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- Add new status fields to Post
ALTER TABLE "Post" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Post" ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX "Post_state_idx" ON "Post"("state");

-- Create PostStats table
CREATE TABLE "PostStats" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostStats_postId_key" ON "PostStats"("postId");
CREATE INDEX "PostStats_postId_idx" ON "PostStats"("postId");

ALTER TABLE "PostStats" ADD CONSTRAINT "PostStats_postId_fkey" 
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create data migration tracking table
CREATE TABLE "_dataMigration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "_dataMigration_pkey" PRIMARY KEY ("id")
);
