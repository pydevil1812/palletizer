const round = (v) => Math.round(v);
const FILL_TOLERANCE = 0.15;

/**
 * Produces human-readable tuning suggestions for a computed stack, e.g.
 * "shave N mm off the box to fit one more column". Pure function of the
 * config + resulting layers, kept separate from PalletizerEngine so the
 * packing algorithm and the advice text can evolve independently.
 */
export class RecommendationBuilder {
  build(config, layers, totalHeight, totalWeight) {
    const recs = [];
    const { box, pallet } = config;

    if (!layers.length) {
      recs.push(
        'No box orientation fits the pallet footprint together with the allowed ' +
          'stack height/weight. Check box dimensions against the pallet footprint and deck ' +
          'height, or relax the orientation flags.'
      );
      return recs;
    }

    const bottom = layers[0];
    const [nx, ny] = this._grid(pallet.length, pallet.width, bottom.dimX, bottom.dimY);

    if (nx > 0) {
      const remX = pallet.length - nx * bottom.dimX;
      const target = pallet.length / (nx + 1);
      const red = bottom.dimX - target;
      if (red > 0 && red <= bottom.dimX * FILL_TOLERANCE) {
        const note = remX > 1 ? `, reclaiming the ${round(remX)} mm currently left over` : '';
        recs.push(
          `Reducing the box dimension along pallet length (now ${round(bottom.dimX)} mm) ` +
            `by ~${round(red)} mm (to ~${round(target)} mm) would fit one more column per layer ` +
            `(${nx + 1} instead of ${nx})${note}.`
        );
      }
    }

    if (ny > 0) {
      const remY = pallet.width - ny * bottom.dimY;
      const target = pallet.width / (ny + 1);
      const red = bottom.dimY - target;
      if (red > 0 && red <= bottom.dimY * FILL_TOLERANCE) {
        const note = remY > 1 ? `, reclaiming the ${round(remY)} mm currently left over` : '';
        recs.push(
          `Reducing the box dimension along pallet width (now ${round(bottom.dimY)} mm) ` +
            `by ~${round(red)} mm (to ~${round(target)} mm) would fit one more row per layer ` +
            `(${ny + 1} instead of ${ny})${note}.`
        );
      }
    }

    const n = layers.length;
    const avgDz = layers.reduce((s, l) => s + l.dimZ, 0) / n;
    const availForLayers = config.maxStackHeight - pallet.deckHeight;
    const targetDz = availForLayers / (n + 1);
    const redH = avgDz - targetDz;
    if (redH > 0 && redH <= avgDz * FILL_TOLERANCE) {
      recs.push(
        `Reducing box height by ~${round(redH)} mm (to ~${round(targetDz)} mm) would allow an ` +
          `extra layer (${n + 1} instead of ${n}) within the ${round(config.maxStackHeight)} mm max height.`
      );
    }

    const wHead = pallet.loadCapacity - totalWeight;
    const hHead = config.maxStackHeight - totalHeight;
    if (hHead < avgDz && wHead > box.weight * 5) {
      recs.push(
        `The stack is height-limited: ${round(wHead)} kg of load capacity ` +
          `(${Math.round((wHead / pallet.loadCapacity) * 100)}% of capacity) is unused. A taller ` +
          `allowed stack would let this pallet carry meaningfully more boxes.`
      );
    } else if (wHead < box.weight && hHead > avgDz) {
      recs.push(
        `The stack is weight-limited: ${round(hHead)} mm of allowed height is unused because ` +
          `load capacity (${round(pallet.loadCapacity)} kg) is nearly reached. Lighter boxes or a ` +
          `higher-capacity pallet would use the remaining height.`
      );
    }

    const avgFill =
      layers.reduce((s, l) => s + l.rects.length * (l.dimX * l.dimY), 0) / (n * pallet.length * pallet.width);
    if (avgFill < 0.75) {
      const f = config.orientationFlags;
      const disabled = [];
      if (!f.allowRotateX) disabled.push('tip onto side (X)');
      if (!f.allowRotateY) disabled.push('tip onto end (Y)');
      if (!f.allowRotateZ) disabled.push('rotate footprint (Z)');
      if (disabled.length) {
        recs.push(
          `Average footprint fill per layer is ${Math.round(avgFill * 100)}%, below the 75% ` +
            `rule-of-thumb. These orientations are disabled and could be reviewed if the box can ` +
            `safely be reoriented: ${disabled.join(', ')}.`
        );
      } else {
        recs.push(
          `Average footprint fill per layer is ${Math.round(avgFill * 100)}% even with all ` +
            `rotations allowed. The footprint doesn't divide evenly into the pallet — revisit box ` +
            `length/width, or consider an interlocking pattern (not modeled by this version).`
        );
      }
    }

    return recs;
  }

  _grid(L, W, a, b) {
    if (a <= 0 || b <= 0) return [0, 0];
    return [Math.floor(L / a), Math.floor(W / b)];
  }
}
