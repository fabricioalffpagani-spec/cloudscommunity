CREATE TABLE "ProfileVisit" (
    "profileId" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileVisit_pkey" PRIMARY KEY ("profileId", "visitorId")
);

CREATE INDEX "ProfileVisit_profileId_lastVisitedAt_idx" ON "ProfileVisit"("profileId", "lastVisitedAt");
CREATE INDEX "ProfileVisit_visitorId_idx" ON "ProfileVisit"("visitorId");

ALTER TABLE "ProfileVisit" ADD CONSTRAINT "ProfileVisit_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileVisit" ADD CONSTRAINT "ProfileVisit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
