-- CreateTable
CREATE TABLE "CloudBan" (
    "id" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudReport" (
    "id" UUID NOT NULL,
    "cloudId" UUID NOT NULL,
    "reportedId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "messageId" UUID,
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudBan_cloudId_userId_key" ON "CloudBan"("cloudId", "userId");
CREATE INDEX "CloudBan_cloudId_idx" ON "CloudBan"("cloudId");
CREATE INDEX "CloudBan_userId_idx" ON "CloudBan"("userId");

-- CreateIndex
CREATE INDEX "CloudReport_cloudId_reportedId_idx" ON "CloudReport"("cloudId", "reportedId");
CREATE INDEX "CloudReport_reporterId_idx" ON "CloudReport"("reporterId");

-- AddForeignKey
ALTER TABLE "CloudBan" ADD CONSTRAINT "CloudBan_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudBan" ADD CONSTRAINT "CloudBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudBan" ADD CONSTRAINT "CloudBan_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudReport" ADD CONSTRAINT "CloudReport_cloudId_fkey" FOREIGN KEY ("cloudId") REFERENCES "Cloud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudReport" ADD CONSTRAINT "CloudReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudReport" ADD CONSTRAINT "CloudReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
