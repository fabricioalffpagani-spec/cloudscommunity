BEGIN;

CREATE TEMPORARY TABLE new_invitation_codes ON COMMIT DROP AS
SELECT "userId", prefix || lpad((row_number() OVER (PARTITION BY prefix ORDER BY "userId") - 1)::text, 3, '0') AS code,
       row_number() OVER (PARTITION BY prefix ORDER BY "userId") AS position
FROM (
  SELECT i."userId", rpad(upper(left(regexp_replace(coalesce(p.username, 'user'), '[^a-zA-Z]', '', 'g'), 4)), 4, 'X') AS prefix
  FROM "InvitationCode" i
  LEFT JOIN "Profile" p ON p."userId" = i."userId"
) AS prefixes;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM new_invitation_codes WHERE position > 1000) THEN
    RAISE EXCEPTION 'Cannot assign invitation codes: more than 1000 users share a username prefix';
  END IF;
END $$;

DELETE FROM "InvitationCode";
INSERT INTO "InvitationCode" ("userId", code)
SELECT "userId", code FROM new_invitation_codes;

COMMIT;
