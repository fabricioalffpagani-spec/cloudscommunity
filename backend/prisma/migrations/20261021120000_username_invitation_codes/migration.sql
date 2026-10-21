BEGIN;

-- Keep existing shared links valid while assigning the new visible codes.
ALTER TABLE "InvitationCode" ADD COLUMN "legacyCode" VARCHAR(7);
UPDATE "InvitationCode" SET "legacyCode" = code;
CREATE UNIQUE INDEX "InvitationCode_legacyCode_key" ON "InvitationCode"("legacyCode");

CREATE TEMPORARY TABLE new_invitation_codes ON COMMIT DROP AS
WITH requested AS (
  SELECT i."userId", rpad(upper(left(regexp_replace(coalesce(p.username, 'user'), '[^a-zA-Z]', '', 'g'), 4)), 4, 'X') AS prefix,
         row_number() OVER (PARTITION BY rpad(upper(left(regexp_replace(coalesce(p.username, 'user'), '[^a-zA-Z]', '', 'g'), 4)), 4, 'X') ORDER BY i."userId") AS ordinal
  FROM "InvitationCode" i
  LEFT JOIN "Profile" p ON p."userId" = i."userId"
), available AS (
  SELECT prefixes.prefix, prefixes.prefix || lpad(numbers.n::text, 3, '0') AS code,
         row_number() OVER (PARTITION BY prefixes.prefix ORDER BY numbers.n) AS ordinal
  FROM (SELECT DISTINCT prefix FROM requested) prefixes
  CROSS JOIN generate_series(0, 999) numbers(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM "InvitationCode" existing
    WHERE existing."legacyCode" = prefixes.prefix || lpad(numbers.n::text, 3, '0')
  )
)
SELECT requested."userId", available.code
FROM requested
JOIN available ON available.prefix = requested.prefix AND available.ordinal = requested.ordinal;

DO $$
BEGIN
  IF (SELECT count(*) FROM new_invitation_codes) <> (SELECT count(*) FROM "InvitationCode") THEN
    RAISE EXCEPTION 'Cannot assign invitation codes: a username prefix has no free code';
  END IF;
END $$;

UPDATE "InvitationCode" invitation
SET code = candidate.code
FROM new_invitation_codes candidate
WHERE invitation."userId" = candidate."userId";

COMMIT;
