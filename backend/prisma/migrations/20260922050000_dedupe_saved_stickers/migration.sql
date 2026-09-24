-- Keep a single saved copy of each identical sticker for each user.
DELETE FROM "SavedSticker" AS duplicate
USING "SavedSticker" AS original
WHERE duplicate."userId" = original."userId"
  AND duplicate."mediaUrl" = original."mediaUrl"
  AND duplicate.ctid > original.ctid;

ALTER TABLE "SavedSticker" ADD COLUMN "contentHash" VARCHAR(32);
UPDATE "SavedSticker" SET "contentHash" = md5("mediaUrl");
ALTER TABLE "SavedSticker" ALTER COLUMN "contentHash" SET NOT NULL;
CREATE UNIQUE INDEX "SavedSticker_userId_contentHash_key"
  ON "SavedSticker"("userId", "contentHash");
