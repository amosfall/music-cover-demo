-- Add missing AlbumCover columns. Run in Neon SQL Editor.
ALTER TABLE "AlbumCover"
  ADD COLUMN IF NOT EXISTS "songId"   TEXT,
  ADD COLUMN IF NOT EXISTS "songName" TEXT,
  ADD COLUMN IF NOT EXISTS "lyrics"   TEXT;
