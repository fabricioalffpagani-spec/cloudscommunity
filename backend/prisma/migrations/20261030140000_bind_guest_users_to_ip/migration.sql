ALTER TABLE "User" ADD COLUMN "guestIpAddress" VARCHAR(64);

CREATE UNIQUE INDEX "User_guestIpAddress_key" ON "User"("guestIpAddress");
