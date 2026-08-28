-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'follow_request';

-- CreateTable
CREATE TABLE "FollowRequest" (
    "requesterId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("requesterId","targetId")
);

-- CreateIndex
CREATE INDEX "FollowRequest_requesterId_idx" ON "FollowRequest"("requesterId");

-- CreateIndex
CREATE INDEX "FollowRequest_targetId_idx" ON "FollowRequest"("targetId");

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_users_different_check" CHECK ("requesterId" <> "targetId");
