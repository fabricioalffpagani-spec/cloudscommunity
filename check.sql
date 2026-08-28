SELECT type, title, body FROM "Notification" ORDER BY "createdAt" DESC LIMIT 10;
SELECT "requesterId", "targetId", "createdAt" FROM "FollowRequest" ORDER BY "createdAt" DESC LIMIT 10;
SELECT "isPrivate", "displayName" FROM "Profile" LIMIT 10;
