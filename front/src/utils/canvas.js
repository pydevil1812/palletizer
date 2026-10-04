/** Largest scale (scene units per mm) that fits a W x H mm extent inside the canvas, minus padding. */
export function fitScale(canvas, W, H, pad) {
  const sw = (canvas.width - 2 * pad) / W;
  const sh = (canvas.height - 2 * pad) / H;
  return Math.min(sw, sh);
}
