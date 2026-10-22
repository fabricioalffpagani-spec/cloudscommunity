import { describe, expect, it } from "vitest";
import { recordedAudioBlob } from "../app/lib/recorded-audio";

describe("recorded audio format", () => {
  it("preserves the recorder's MP4 or WebM format", () => {
    expect(recordedAudioBlob([new Blob(["audio"])], "audio/mp4").type).toBe("audio/mp4");
    expect(recordedAudioBlob([new Blob(["audio"])], "audio/webm").type).toBe("audio/webm");
  });
  it("uses the recorded chunk's type when the recorder does not report one", () => {
    expect(recordedAudioBlob([new Blob(["audio"], { type: "audio/mp4" })], "").type).toBe("audio/mp4");
  });
});
