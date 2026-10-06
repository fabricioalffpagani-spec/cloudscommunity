ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'cloud_recommendation';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'cloud_trending';

ALTER TABLE "Profile"
  ADD COLUMN "interestsOnboardingRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CloudInterestRecommendationDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "slotKey" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudInterestRecommendationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudInterestRecommendationDelivery_userId_slotKey_key"
  ON "CloudInterestRecommendationDelivery"("userId", "slotKey");
CREATE UNIQUE INDEX "CloudInterestRecommendationDelivery_userId_cloudId_key"
  ON "CloudInterestRecommendationDelivery"("userId", "cloudId");
CREATE INDEX "CloudInterestRecommendationDelivery_userId_createdAt_idx"
  ON "CloudInterestRecommendationDelivery"("userId", "createdAt");

CREATE TABLE "CloudTrendingDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudTrendingDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudTrendingDelivery_userId_cloudId_key"
  ON "CloudTrendingDelivery"("userId", "cloudId");
CREATE INDEX "CloudTrendingDelivery_userId_createdAt_idx"
  ON "CloudTrendingDelivery"("userId", "createdAt");

CREATE TABLE "CloudShare" (
    "cloudId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudShare_pkey" PRIMARY KEY ("cloudId", "userId"),
    CONSTRAINT "CloudShare_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CloudShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CloudShare_userId_idx" ON "CloudShare"("userId");
