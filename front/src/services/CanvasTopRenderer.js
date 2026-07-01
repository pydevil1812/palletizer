import { ColorService } from './ColorService.js';
import { fitScale } from '../utils/canvas.js';
import { fmt } from '../utils/format.js';

/** Draws the top-down (plan) view of a single layer onto a 2D canvas. */
export class CanvasTopRenderer {
  /** Returns { boxCount, orientation, zStart } for the drawn layer, or null if nothing to draw. */
  draw(canvas, result, layerIndex, t) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!result || !result.layers.length) {
      ctx.fillStyle = '#5b6a7d';
      ctx.font = '14px system-ui';
      ctx.fillText(t('views.noLayout'), 20, 30);
      return null;
    }

    const li = Math.min(layerIndex || 0, result.layers.length - 1);
    const layer = result.layers[li];
    const pallet = result.config.pallet;
    const pad = 46;
    const s = fitScale(canvas, pallet.length, pallet.width, pad);
    const ox = (canvas.width - pallet.length * s) / 2;
    const oy = (canvas.height - pallet.width * s) / 2;

    ctx.fillStyle = '#2a2014';
    ctx.strokeStyle = '#6b5331';
    ctx.lineWidth = 2;
    ctx.fillRect(ox, oy, pallet.length * s, pallet.width * s);
    ctx.strokeRect(ox, oy, pallet.length * s, pallet.width * s);

    const color = ColorService.layerColor(li, result.layers.length);
    ctx.lineWidth = 1.5;
    const idBase = result.placed.findIndex((b) => b.layer === layer.index) + 1;
    layer.rects.forEach((r, k) => {
      const x = ox + r.x * s;
      const y = oy + r.y * s;
      const w = r.w * s;
      const h = r.h * s;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0c1118';
      ctx.strokeRect(x, y, w, h);
      if (w > 22 && h > 16) {
        ctx.fillStyle = '#06121f';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idBase + k, x + w / 2, y + h / 2);
      }
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#93a4b8';
    ctx.font = '12px system-ui';
    ctx.fillText(t('views.axisArrowLabel', { axis: t('views.lengthAxis'), mm: fmt(pallet.length) }), ox, oy - 14);
    ctx.save();
    ctx.translate(ox - 16, oy + (pallet.width * s) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(t('views.axisLabel', { axis: t('views.widthAxis'), mm: fmt(pallet.width) }), 0, 0);
    ctx.restore();

    return { boxCount: layer.rects.length, orientation: layer.orientation, zStart: layer.zStart };
  }
}
