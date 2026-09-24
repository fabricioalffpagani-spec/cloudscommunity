ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'cloud_continuation';
ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
