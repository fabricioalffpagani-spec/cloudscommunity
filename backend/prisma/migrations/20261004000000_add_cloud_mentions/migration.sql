ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'cloud_mention';

ALTER TABLE "CloudMessage"
ADD COLUMN "mentions" JSONB NOT NULL DEFAULT '[]'::jsonb;
