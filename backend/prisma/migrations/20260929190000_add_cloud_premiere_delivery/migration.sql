CREATE TABLE "CloudPremiereDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cloudId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudPremiereDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudPremiereDelivery_cloudId_userId_key" ON "CloudPremiereDelivery"("cloudId", "userId");
CREATE INDEX "CloudPremiereDelivery_userId_createdAt_idx" ON "CloudPremiereDelivery"("userId", "createdAt");
