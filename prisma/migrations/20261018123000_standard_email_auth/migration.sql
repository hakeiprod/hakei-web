BEGIN;
-- Stop rather than merging users with colliding normalized addresses.
DO $$ BEGIN
 IF EXISTS (SELECT lower(btrim(email)) FROM users WHERE email IS NOT NULL GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Conflicting email addresses: resolve manually before email authentication migration';
 END IF;
END $$;
UPDATE users SET email = lower(btrim(email)) WHERE email IS NOT NULL;
-- Preserve users/accounts/domain data; require a fresh standard login.
DELETE FROM sessions;
DELETE FROM verification_tokens;
DROP TABLE "AuthNotice", "AuthChangeEvent", "AuthAttempt", "AuthRateWindow", "ReauthIntent", "AuthSessionRecord", "AuthChallenge", "AuthChallengeHead", "PasswordCredential", "OAuthCreationReceipt", "EmailIdentity";
ALTER TABLE users DROP COLUMN "authVersion";
COMMIT;
