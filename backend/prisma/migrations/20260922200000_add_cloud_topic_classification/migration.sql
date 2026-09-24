ALTER TABLE "Cloud"
  ADD COLUMN "primaryTopic" VARCHAR(50),
  ADD COLUMN "topicScores" JSONB,
  ADD COLUMN "topicKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "topicConfidence" DOUBLE PRECISION,
  ADD COLUMN "classificationVersion" VARCHAR(20),
  ADD COLUMN "classifiedAt" TIMESTAMP(3);

CREATE INDEX "Cloud_primaryTopic_idx" ON "Cloud"("primaryTopic");
