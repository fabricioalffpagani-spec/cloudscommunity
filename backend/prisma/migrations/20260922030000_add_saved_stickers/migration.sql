ALTER TABLE "CloudMessage" ADD COLUMN "isSticker" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SavedSticker" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSticker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedSticker_userId_mediaUrl_key" ON "SavedSticker"("userId", "mediaUrl");
CREATE INDEX "SavedSticker_userId_createdAt_idx" ON "SavedSticker"("userId", "createdAt");
ALTER TABLE "SavedSticker" ADD CONSTRAINT "SavedSticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
