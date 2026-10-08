-- User-saved stickers stay private. The shared catalogue contains only the
-- official Clouds pack served from /api/stickers/system/.
DELETE FROM "SystemSticker"
WHERE "mediaUrl" NOT LIKE '/api/stickers/system/%';
