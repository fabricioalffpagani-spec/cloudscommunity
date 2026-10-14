CREATE TABLE "CloudMessageView" (
  "messageId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudMessageView_pkey" PRIMARY KEY ("messageId", "userId")
);

ALTER TABLE "CloudMessageView" ADD CONSTRAINT "CloudMessageView_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "CloudMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudMessageView" ADD CONSTRAINT "CloudMessageView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CloudMessageView_userId_viewedAt_idx" ON "CloudMessageView"("userId", "viewedAt");
