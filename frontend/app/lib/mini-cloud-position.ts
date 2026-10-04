export function clampMiniCloudPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  inset = 8,
) {
  return {
    x: Math.max(width - viewportWidth + inset, Math.min(inset, x)),
    y: Math.max(height - viewportHeight + inset, Math.min(inset, y)),
  };
}
