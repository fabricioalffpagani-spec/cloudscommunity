ALTER TABLE "Cloud" ADD COLUMN "originCloudId" UUID;
CREATE INDEX "Cloud_originCloudId_idx" ON "Cloud"("originCloudId");
ALTER TABLE "Cloud" ADD CONSTRAINT "Cloud_originCloudId_fkey" FOREIGN KEY ("originCloudId") REFERENCES "Cloud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
