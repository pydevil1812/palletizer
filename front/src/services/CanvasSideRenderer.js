import { ColorService } from './ColorService.js';
import { fitScale } from '../utils/canvas.js';
import { fmt } from '../utils/format.js';

/** Draws the side elevation (all boxes projected onto one base axis + height) onto a 2D canvas. */
export class CanvasSideRenderer {
  /** axis: 'length' | 'width' */
  draw(canvas, result, axis, t) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!result || !result.layers.length) {
      ctx.fillStyle = '#5b6a7d';
      ctx.font = '14px system-ui';
      ctx.fillText(t('views.noLayout'), 20, 30);
      return;
    }

    const pallet = result.config.pallet;
    const baseW = axis === 'length' ? pallet.length : pallet.width;
    const totalH = result.config.maxStackHeight;
    const pad = 46;
    const s = fitScale(canvas, baseW, totalH, pad);
    const ox = (canvas.width - baseW * s) / 2;
    const oy = canvas.height - pad; // floor line at bottom
    const Y = (mm) => oy - mm * s; // height -> screen y

    ctx.strokeStyle = '#3a2f17';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, Y(totalH));
    ctx.lineTo(ox + baseW * s, Y(totalH));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e7a13a';
    ctx.font = '11px system-ui';
    ctx.fillText(t('views.maxHeightLabel', { mm: fmt(totalH) }), ox, Y(totalH) - 4);

    ctx.fillStyle = '#2a2014';
    ctx.strokeStyle = '#6b5331';
    ctx.lineWidth = 2;
    ctx.fillRect(ox, Y(pallet.deckHeight), baseW * s, pallet.deckHeight * s);
    ctx.strokeRect(ox, Y(pallet.deckHeight), baseW * s, pallet.deckHeight * s);

    const n = result.layers.length;
    ctx.lineWidth = 1;
    result.placed.forEach((b) => {
      const along = axis === 'length' ? b.x : b.y;
      const dlen = axis === 'length' ? b.dimX : b.dimY;
      const x = ox + along * s;
      const w = dlen * s;
      const h = b.dimZ * s;
      const y = Y(b.z + b.dimZ);
      ctx.fillStyle = ColorService.layerColor(b.layer, n);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0c1118';
      ctx.strokeRect(x, y, w, h);
    });

    ctx.fillStyle = '#93a4b8';
    ctx.font = '12px system-ui';
    ctx.fillText(
      t('views.axisLabel', { axis: axis === 'length' ? t('views.lengthAxis') : t('views.widthAxis'), mm: fmt(baseW) }),
      ox,
      oy + 22
    );
    ctx.save();
    ctx.translate(ox - 18, (Y(0) + Y(totalH)) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(t('views.heightAxisLabel'), 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
