-- Phone is no longer collected during signup.
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "phone";
