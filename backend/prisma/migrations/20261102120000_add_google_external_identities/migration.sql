-- Google/OIDC identities are additive. Existing password accounts remain unchanged.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TYPE "ExternalIdentityProvider" AS ENUM ('GOOGLE');
CREATE TYPE "GooglePendingAccountKind" AS ENUM ('REGISTER', 'LINK');

CREATE TABLE "ExternalIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalIdentityProvider" NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleOAuthState" (
    "id" UUID NOT NULL,
    "stateHash" VARCHAR(64) NOT NULL,
    "intent" VARCHAR(20) NOT NULL,
    "userId" UUID,
    "returnTo" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GooglePendingAccount" (
    "id" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "kind" "GooglePendingAccountKind" NOT NULL,
    "userId" UUID,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "displayName" VARCHAR(120),
    "avatarUrl" TEXT,
    "returnTo" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GooglePendingAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIdentity_provider_providerAccountId_key" ON "ExternalIdentity"("provider", "providerAccountId");
CREATE INDEX "ExternalIdentity_userId_idx" ON "ExternalIdentity"("userId");
CREATE UNIQUE INDEX "GoogleOAuthState_stateHash_key" ON "GoogleOAuthState"("stateHash");
CREATE INDEX "GoogleOAuthState_expiresAt_idx" ON "GoogleOAuthState"("expiresAt");
CREATE UNIQUE INDEX "GooglePendingAccount_tokenHash_key" ON "GooglePendingAccount"("tokenHash");
CREATE INDEX "GooglePendingAccount_expiresAt_idx" ON "GooglePendingAccount"("expiresAt");
CREATE INDEX "GooglePendingAccount_userId_idx" ON "GooglePendingAccount"("userId");

ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleOAuthState" ADD CONSTRAINT "GoogleOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GooglePendingAccount" ADD CONSTRAINT "GooglePendingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
