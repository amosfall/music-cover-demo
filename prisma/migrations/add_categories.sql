-- Add Category model and categoryId to AlbumCover
-- Run with: psql $DATABASE_URL -f prisma/migrations/add_categories.sql

CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "AlbumCover" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- Optional: Create default categories (run after table exists)
-- INSERT INTO "Category" ("id", "name", "sortOrder") VALUES
--   (gen_random_uuid()::text, 'Default', 0),
--   (gen_random_uuid()::text, 'Anpu/Deserts', 1),
--   (gen_random_uuid()::text, 'Pink Floyd', 2)
-- ON CONFLICT DO NOTHING;
