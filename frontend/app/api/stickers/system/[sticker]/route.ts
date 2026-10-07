const STICKERS = {
  alegria: { eyes: "smile", mouth: "M92 142 Q120 169 148 142", accent: "#D8B4FE" },
  risada: { eyes: "closed", mouth: "M89 139 Q120 181 151 139 Q120 156 89 139", accent: "#FDE68A" },
  amor: { eyes: "heart", mouth: "M101 150 Q120 163 139 150", accent: "#F9A8D4" },
  piscadinha: { eyes: "wink", mouth: "M100 147 Q120 164 140 147", accent: "#FDBA74" },
  festa: { eyes: "wide", mouth: "M101 145 Q120 177 139 145 Z", accent: "#F0ABFC" },
  oi: { eyes: "wide", mouth: "M106 150 Q120 159 134 150", accent: "#BFDBFE" },
  surpresa: { eyes: "wide", mouth: "M108 145 Q120 162 132 145 Q120 137 108 145", accent: "#FDE68A" },
  sono: { eyes: "closed", mouth: "M106 151 Q120 157 134 151", accent: "#C4B5FD" },
  triste: { eyes: "sad", mouth: "M101 160 Q120 142 139 160", accent: "#93C5FD" },
  choro: { eyes: "sad", mouth: "M102 161 Q120 145 138 161", accent: "#67E8F9" },
  bravo: { eyes: "angry", mouth: "M104 160 L136 160", accent: "#FCA5A5" },
  confuso: { eyes: "uneven", mouth: "M101 155 Q120 147 139 156", accent: "#DDD6FE" },
  pensativo: { eyes: "uneven", mouth: "M105 158 Q120 151 135 158", accent: "#A7F3D0" },
  silencioso: { eyes: "wide", mouth: "M102 155 L138 155", accent: "#E9D5FF" },
  beijo: { eyes: "closed", mouth: "M112 151 Q120 143 128 151", accent: "#FDA4AF" },
  legal: { eyes: "smile", mouth: "M102 148 Q120 162 138 148", accent: "#86EFAC" },
  brilho: { eyes: "sparkle", mouth: "M101 148 Q120 164 139 148", accent: "#FDE047" },
  nervoso: { eyes: "wide", mouth: "M102 154 L109 160 L116 154 L123 160 L130 154 L138 160", accent: "#A5B4FC" },
  coracao: { eyes: "heart", mouth: "M103 151 Q120 166 137 151", accent: "#FB7185" },
  vitoria: { eyes: "smile", mouth: "M99 146 Q120 171 141 146", accent: "#FDE68A" },
} as const;

type StickerName = keyof typeof STICKERS;

function eyeMarkup(kind: (typeof STICKERS)[StickerName]["eyes"]) {
  if (kind === "heart") return '<path d="M95 122c-7-9-20 2 0 16 20-14 7-25 0-16Zm50 0c-7-9-20 2 0 16 20-14 7-25 0-16Z" fill="#2A0A62"/>';
  if (kind === "closed") return '<path d="M88 132q8 8 16 0m32 0q8 8 16 0" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round"/>';
  if (kind === "wink") return '<circle cx="96" cy="129" r="5" fill="#2A0A62"/><path d="M137 132h15" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round"/>';
  if (kind === "sad") return '<path d="M88 130q8-8 16 0m32 0q8-8 16 0" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round"/>';
  if (kind === "angry") return '<path d="m87 123 17 6m32 0 17-6" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round"/><circle cx="96" cy="134" r="3" fill="#2A0A62"/><circle cx="144" cy="134" r="3" fill="#2A0A62"/>';
  if (kind === "uneven") return '<circle cx="96" cy="129" r="5" fill="#2A0A62"/><path d="M137 128q7-8 14 0" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round"/>';
  if (kind === "sparkle") return '<path d="m96 119 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Zm48 0 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#2A0A62"/>';
  if (kind === "smile") return '<circle cx="96" cy="129" r="5" fill="#2A0A62"/><circle cx="144" cy="129" r="5" fill="#2A0A62"/>';
  return '<circle cx="96" cy="129" r="6" fill="#2A0A62"/><circle cx="144" cy="129" r="6" fill="#2A0A62"/>';
}

function stickerSvg(name: StickerName) {
  const config = STICKERS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Figurinha Clouds ${name}">
  <defs><filter id="s"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#12032A" flood-opacity=".22"/></filter></defs>
  <path d="M55 143c0-20 15-36 35-37 7-22 28-36 52-32 20 3 35 17 40 35 18 2 32 17 32 35 0 20-16 36-36 36h-37l-20 19-2-19H91c-20 0-36-16-36-37Z" fill="#fff" filter="url(#s)"/>
  <path d="M55 143c0-20 15-36 35-37 7-22 28-36 52-32 20 3 35 17 40 35 18 2 32 17 32 35 0 20-16 36-36 36h-37l-20 19-2-19H91c-20 0-36-16-36-37Z" fill="none" stroke="#EDE9FE" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="120" cy="143" rx="42" ry="31" fill="${config.accent}" fill-opacity=".34"/>
  ${eyeMarkup(config.eyes)}<path d="${config.mouth}" fill="none" stroke="#2A0A62" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="82" cy="147" r="5" fill="#F9A8D4" fill-opacity=".75"/><circle cx="158" cy="147" r="5" fill="#F9A8D4" fill-opacity=".75"/>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ sticker: string }> }) {
  const { sticker } = await params;
  if (!(sticker in STICKERS)) return new Response("Not found", { status: 404 });
  return new Response(stickerSvg(sticker as StickerName), {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
