-- CreateTable
CREATE TABLE "CloudInvite" (
    "id" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CloudInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudInvite_token_key" ON "CloudInvite"("token");

-- CreateIndex
CREATE INDEX "CloudInvite_cloudId_idx" ON "CloudInvite"("cloudId");

-- CreateIndex
CREATE INDEX "CloudInvite_token_idx" ON "CloudInvite"("token");

-- AddForeignKey
ALTER TABLE "CloudInvite" ADD CONSTRAINT "CloudInvite_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
