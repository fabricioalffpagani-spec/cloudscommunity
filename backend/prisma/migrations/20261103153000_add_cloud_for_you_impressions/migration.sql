CREATE TABLE "CloudForYouImpression" (
    "cloudId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloudForYouImpression_pkey" PRIMARY KEY ("cloudId", "userId")
);

CREATE INDEX "CloudForYouImpression_userId_firstSeenAt_idx" ON "CloudForYouImpression"("userId", "firstSeenAt");
