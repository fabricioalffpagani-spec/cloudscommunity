/** Preserve the format selected by the browser, including Safari's MP4 audio. */
export function recordedAudioBlob(chunks: Blob[], recorderMimeType: string): Blob {
  return new Blob(chunks, { type: recorderMimeType || chunks.find((chunk) => chunk.type)?.type || "" });
}
