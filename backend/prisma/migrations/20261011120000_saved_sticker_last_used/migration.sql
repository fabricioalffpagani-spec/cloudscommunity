ALTER TABLE "SavedSticker" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
CREATE INDEX "SavedSticker_userId_lastUsedAt_createdAt_idx" ON "SavedSticker"("userId", "lastUsedAt" DESC, "createdAt" DESC);
