ALTER TABLE "User"
  ADD COLUMN "isTestClouder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "testClouderBatchId" VARCHAR(80);

CREATE INDEX "User_isTestClouder_idx" ON "User"("isTestClouder");
