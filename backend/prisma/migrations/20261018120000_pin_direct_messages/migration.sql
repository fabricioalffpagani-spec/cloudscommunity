ALTER TABLE "DirectMessage" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "DirectMessage_conversationId_isPinned_idx" ON "DirectMessage"("conversationId", "isPinned");
