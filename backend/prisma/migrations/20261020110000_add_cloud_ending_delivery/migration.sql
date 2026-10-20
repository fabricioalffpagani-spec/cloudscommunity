CREATE TABLE "CloudEndingDelivery" (
    "id" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloudEndingDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudEndingDelivery_cloudId_userId_key" ON "CloudEndingDelivery"("cloudId", "userId");
CREATE INDEX "CloudEndingDelivery_userId_createdAt_idx" ON "CloudEndingDelivery"("userId", "createdAt");
