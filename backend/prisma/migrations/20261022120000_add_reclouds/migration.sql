CREATE TABLE "Recloud" (
  "cloudId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Recloud_pkey" PRIMARY KEY ("cloudId", "userId"),
  CONSTRAINT "Recloud_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Recloud_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Recloud_userId_createdAt_idx" ON "Recloud"("userId", "createdAt");
