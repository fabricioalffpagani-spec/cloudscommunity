export async function recordStickerUse(mediaUrl: string) {
  const response = await fetch("/api/stickers/use", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaUrl }),
  });
  if (!response.ok)
    throw new Error("Não foi possível atualizar o uso da figurinha.");
}
