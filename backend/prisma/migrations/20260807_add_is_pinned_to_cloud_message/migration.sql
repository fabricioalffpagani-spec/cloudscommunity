-- AlterTable
ALTER TABLE "CloudMessage" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CloudMessage_cloudId_isPinned_idx" ON "CloudMessage"("cloudId", "isPinned");
