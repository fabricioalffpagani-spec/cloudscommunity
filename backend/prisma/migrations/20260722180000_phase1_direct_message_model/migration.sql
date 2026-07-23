-- Make direct conversations order-independent and add message/media metadata.

-- Conversation
ALTER TABLE "Conversation" ADD COLUMN "conversationKey" VARCHAR(100);
ALTER TABLE "Conversation" ADD COLUMN "lastMessageId" UUID;
ALTER TABLE "Conversation" ADD COLUMN "lastMessageType" "MessageType";
ALTER TABLE "Conversation" ADD COLUMN "participantOneLastReadAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "participantTwoLastReadAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "participantOneUnreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "participantTwoUnreadCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Conversation"
SET "conversationKey" = CASE
  WHEN "participantOneId" < "participantTwoId"
    THEN "participantOneId"::text || ':' || "participantTwoId"::text
  ELSE "participantTwoId"::text || ':' || "participantOneId"::text
END;

ALTER TABLE "Conversation" ALTER COLUMN "conversationKey" SET NOT NULL;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lastMessageId_fkey"
  FOREIGN KEY ("lastMessageId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Conversation_participantOneId_participantTwoId_key";
CREATE UNIQUE INDEX "Conversation_conversationKey_key" ON "Conversation"("conversationKey");

-- DirectMessage
ALTER TABLE "DirectMessage" ADD COLUMN "mediaAssetId" UUID;
ALTER TABLE "DirectMessage" ADD COLUMN "clientMessageId" VARCHAR(80);

ALTER TABLE "DirectMessage" DROP COLUMN "mediaUrl";

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DirectMessage_mediaAssetId_idx" ON "DirectMessage"("mediaAssetId");
CREATE UNIQUE INDEX "DirectMessage_conversationId_clientMessageId_key" ON "DirectMessage"("conversationId", "clientMessageId");

-- MediaAsset
ALTER TABLE "MediaAsset" ADD COLUMN "originalFileName" VARCHAR(255);
ALTER TABLE "MediaAsset" ADD COLUMN "width" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN "height" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN "durationMs" INTEGER;

