import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AudioWaveformPlayer } from "../app/components/AudioWaveformPlayer";

afterEach(() => vi.restoreAllMocks());

it("renders the purple player with playback, waveform, speed and duration on one row", () => {
  const { container } = render(<AudioWaveformPlayer src="/audio.mp3" durationMs={20000} peaks={[0.2, 0.8, 0.4]} />);
  const play = screen.getByRole("button", { name: "Reproduzir áudio" });
  const waveform = screen.getByRole("slider", { name: "Posição do áudio" });
  const speed = screen.getByRole("combobox", { name: "Velocidade de reprodução" });
  expect(play.parentElement).toHaveClass("bg-[#8a20e9]", "max-w-full");
  expect(waveform.parentElement).toContainElement(speed);
  expect(screen.getByText("0:20")).toBeInTheDocument();
  expect(container.querySelector("audio")).toHaveAttribute("src", "/audio.mp3");
});

it("controls playback, speed and seeking without losing audio behavior", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const { container } = render(<AudioWaveformPlayer src="/audio.mp3" durationMs={20000} peaks={[0.2, 0.8]} isOwn />);
  const audio = container.querySelector("audio") as HTMLAudioElement;
  fireEvent.click(screen.getByRole("button", { name: "Reproduzir áudio" }));
  expect(play).toHaveBeenCalled();
  fireEvent.play(audio);
  expect(screen.getByRole("button", { name: "Pausar áudio" })).toBeInTheDocument();
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  fireEvent.click(screen.getByRole("button", { name: "Pausar áudio" }));
  expect(pause).toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Velocidade de reprodução" }), { target: { value: "1.5" } });
  expect(audio.playbackRate).toBe(1.5);
  const waveform = screen.getByRole("slider", { name: "Posição do áudio" });
  vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 10, width: 100 } as DOMRect);
  fireEvent.click(waveform, { clientX: 60 });
  expect(audio.currentTime).toBe(10);
  fireEvent.keyDown(waveform, { key: "ArrowRight" });
  expect(audio.currentTime).toBe(15);
  fireEvent.ended(audio);
  expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeInTheDocument();
});

it("keeps forwarded audio aligned to its header", () => {
  render(<AudioWaveformPlayer src="/audio.mp3" peaks={[0.5]} flatTop />);
  expect(screen.getByRole("button", { name: "Reproduzir áudio" }).parentElement).toHaveClass("rounded-b-2xl");
});
