-- Add phone field to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
