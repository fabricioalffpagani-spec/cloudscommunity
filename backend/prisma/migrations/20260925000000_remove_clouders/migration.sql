DROP INDEX IF EXISTS "User_isTestClouder_idx";

ALTER TABLE "User"
  DROP COLUMN "isTestClouder",
  DROP COLUMN "testClouderBatchId";
