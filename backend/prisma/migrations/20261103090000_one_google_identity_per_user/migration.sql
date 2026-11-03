-- Each Clouds account may have at most one identity for a given provider.
-- If inconsistent duplicate links already exist, deployment stops for manual review
-- instead of deleting or reassigning any user data automatically.
CREATE UNIQUE INDEX "ExternalIdentity_userId_provider_key"
ON "ExternalIdentity"("userId", "provider");
