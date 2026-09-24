ALTER TABLE "SearchHistory" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'query';
ALTER TABLE "SearchHistory" ADD COLUMN "targetId" VARCHAR(255);
ALTER TABLE "SearchHistory" ADD COLUMN "subtitle" VARCHAR(255);
ALTER TABLE "SearchHistory" ADD COLUMN "avatarUrl" TEXT;
UPDATE "SearchHistory" SET "targetId" = "query";
DROP INDEX "SearchHistory_userId_query_key";
CREATE UNIQUE INDEX "SearchHistory_userId_kind_targetId_key" ON "SearchHistory"("userId", "kind", "targetId");
