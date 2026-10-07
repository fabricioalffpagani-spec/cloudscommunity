-- Platform-owned sticker catalogue, shared by CloudChat and private messages.
CREATE TABLE "SystemSticker" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mediaUrl" TEXT NOT NULL,
  "contentHash" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSticker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemSticker_contentHash_key" ON "SystemSticker"("contentHash");
CREATE INDEX "SystemSticker_createdAt_idx" ON "SystemSticker"("createdAt");

-- Preserve every legacy saved sticker by importing one canonical copy of it.
INSERT INTO "SystemSticker" ("id", "mediaUrl", "contentHash", "createdAt")
SELECT DISTINCT ON ("contentHash") "id", "mediaUrl", "contentHash", "createdAt"
FROM "SavedSticker"
ORDER BY "contentHash", "createdAt" ASC;

-- SavedSticker remains each user's personal save history; SystemSticker is the
-- shared source shown in the picker.
DROP INDEX IF EXISTS "SavedSticker_userId_contentHash_key";
DROP INDEX IF EXISTS "SavedSticker_contentHash_key";
CREATE UNIQUE INDEX "SavedSticker_userId_contentHash_key" ON "SavedSticker"("userId", "contentHash");

