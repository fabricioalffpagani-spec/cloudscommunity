CREATE TABLE "GuestCloudVisit" (
    "id" UUID NOT NULL,
    "ipHash" VARCHAR(64) NOT NULL,
    "cloudId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestCloudVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestCloudVisit_ipHash_cloudId_key" ON "GuestCloudVisit"("ipHash", "cloudId");
CREATE INDEX "GuestCloudVisit_ipHash_createdAt_idx" ON "GuestCloudVisit"("ipHash", "createdAt");
ALTER TABLE "GuestCloudVisit" ADD CONSTRAINT "GuestCloudVisit_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
