-- Initial collection of official Clouds stickers, shared by every account.
-- The SVGs are served by the frontend itself, keeping the catalogue fast,
-- versioned and independent from external image hosts.
INSERT INTO "SystemSticker" ("mediaUrl", "contentHash")
VALUES
  ('/api/stickers/system/alegria?v=2', md5('/api/stickers/system/alegria?v=2')),
  ('/api/stickers/system/risada?v=2', md5('/api/stickers/system/risada?v=2')),
  ('/api/stickers/system/amor?v=2', md5('/api/stickers/system/amor?v=2')),
  ('/api/stickers/system/piscadinha?v=2', md5('/api/stickers/system/piscadinha?v=2')),
  ('/api/stickers/system/festa?v=2', md5('/api/stickers/system/festa?v=2')),
  ('/api/stickers/system/oi?v=2', md5('/api/stickers/system/oi?v=2')),
  ('/api/stickers/system/surpresa?v=2', md5('/api/stickers/system/surpresa?v=2')),
  ('/api/stickers/system/sono?v=2', md5('/api/stickers/system/sono?v=2')),
  ('/api/stickers/system/triste?v=2', md5('/api/stickers/system/triste?v=2')),
  ('/api/stickers/system/choro?v=2', md5('/api/stickers/system/choro?v=2')),
  ('/api/stickers/system/bravo?v=2', md5('/api/stickers/system/bravo?v=2')),
  ('/api/stickers/system/confuso?v=2', md5('/api/stickers/system/confuso?v=2')),
  ('/api/stickers/system/pensativo?v=2', md5('/api/stickers/system/pensativo?v=2')),
  ('/api/stickers/system/silencioso?v=2', md5('/api/stickers/system/silencioso?v=2')),
  ('/api/stickers/system/beijo?v=2', md5('/api/stickers/system/beijo?v=2')),
  ('/api/stickers/system/legal?v=2', md5('/api/stickers/system/legal?v=2')),
  ('/api/stickers/system/brilho?v=2', md5('/api/stickers/system/brilho?v=2')),
  ('/api/stickers/system/nervoso?v=2', md5('/api/stickers/system/nervoso?v=2')),
  ('/api/stickers/system/coracao?v=2', md5('/api/stickers/system/coracao?v=2')),
  ('/api/stickers/system/vitoria?v=2', md5('/api/stickers/system/vitoria?v=2'))
ON CONFLICT ("contentHash") DO NOTHING;
