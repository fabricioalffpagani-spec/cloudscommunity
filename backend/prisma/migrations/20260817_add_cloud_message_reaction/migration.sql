-- CreateTable
CREATE TABLE "CloudMessageReaction" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emoji" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CloudMessageReaction_messageId_idx" ON "CloudMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "CloudMessageReaction_userId_idx" ON "CloudMessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudMessageReaction_messageId_userId_emoji_key" ON "CloudMessageReaction"("messageId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "CloudMessageReaction" ADD CONSTRAINT "CloudMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CloudMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudMessageReaction" ADD CONSTRAINT "CloudMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
