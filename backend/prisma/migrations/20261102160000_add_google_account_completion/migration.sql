-- Existing Google users that still lack required Clouds fields are completed in place.
ALTER TYPE "GooglePendingAccountKind" ADD VALUE IF NOT EXISTS 'COMPLETE';
