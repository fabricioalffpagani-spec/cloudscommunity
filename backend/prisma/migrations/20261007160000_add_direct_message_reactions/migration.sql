CREATE TABLE "DirectMessageReaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emoji" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectMessageReaction_messageId_userId_emoji_key"
    ON "DirectMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "DirectMessageReaction_messageId_createdAt_idx"
    ON "DirectMessageReaction"("messageId", "createdAt");
CREATE INDEX "DirectMessageReaction_userId_idx"
    ON "DirectMessageReaction"("userId");

ALTER TABLE "DirectMessageReaction"
    ADD CONSTRAINT "DirectMessageReaction_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessageReaction"
    ADD CONSTRAINT "DirectMessageReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
