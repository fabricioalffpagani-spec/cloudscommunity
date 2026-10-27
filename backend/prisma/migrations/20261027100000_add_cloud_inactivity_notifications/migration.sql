-- CreateEnum
ALTER TYPE "NotificationType" ADD VALUE 'cloud_inactivity';

-- CreateTable
CREATE TABLE "CloudInactivityDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastCloudId" UUID NOT NULL,
    "stage" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudInactivityDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudInactivityDelivery_userId_lastCloudId_stage_key" ON "CloudInactivityDelivery"("userId", "lastCloudId", "stage");
CREATE INDEX "CloudInactivityDelivery_userId_lastCloudId_sentAt_idx" ON "CloudInactivityDelivery"("userId", "lastCloudId", "sentAt");

-- AddForeignKey
ALTER TABLE "CloudInactivityDelivery" ADD CONSTRAINT "CloudInactivityDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudInactivityDelivery" ADD CONSTRAINT "CloudInactivityDelivery_lastCloudId_fkey" FOREIGN KEY ("lastCloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
