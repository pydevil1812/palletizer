/** Assigns each layer a distinct hue across the stack so layers are visually separable. */
export class ColorService {
  static layerColor(index, total) {
    const hue = total <= 1 ? 205 : (index / total) * 300;
    return `hsl(${hue.toFixed(0)},70%,58%)`;
  }
}
