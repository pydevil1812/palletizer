import { Orientation } from './Orientation.js';
import { Layer } from './Layer.js';
import { PlacedBox } from './PlacedBox.js';
import { StackResult } from './StackResult.js';
import { RecommendationBuilder } from './RecommendationBuilder.js';

const MAX_LAYER_ITERATIONS = 1000;

/**
 * Faithful port of the Python `palletizer/packer.py` heuristic:
 * a grid-plus-leftover-strip packer per layer, stacked until the
 * configured max height or pallet load capacity is reached.
 * All linear units are mm, weights kg.
 */
export class PalletizerEngine {
  constructor(recommendationBuilder = new RecommendationBuilder()) {
    this.recommendationBuilder = recommendationBuilder;
  }

  /** Enumerates the distinct box orientations reachable via the allowed axis swaps. */
  generateOrientations(box, flags) {
    const start = ['L', 'W', 'H'];
    const swapX = (a) => [a[0], a[2], a[1]]; // swap Y<->Z
    const swapY = (a) => [a[2], a[1], a[0]]; // swap X<->Z
    const swapZ = (a) => [a[1], a[0], a[2]]; // swap X<->Y

    const gens = [];
    if (flags.allowRotateX) gens.push(swapX);
    if (flags.allowRotateY) gens.push(swapY);
    if (flags.allowRotateZ) gens.push(swapZ);

    const key = (a) => a.join('');
    const seen = new Map();
    seen.set(key(start), start);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const state of frontier) {
        for (const g of gens) {
          const candidate = g(state);
          const k = key(candidate);
          if (!seen.has(k)) {
            seen.set(k, candidate);
            next.push(candidate);
          }
        }
      }
      frontier = next;
    }

    const dims = { L: box.length, W: box.width, H: box.height };
    const out = [];
    for (const a of seen.values()) {
      out.push(new Orientation(dims[a[0]], dims[a[1]], dims[a[2]], `${a[0]}-x,${a[1]}-y,${a[2]}-z`));
    }
    return out;
  }

  grid(L, W, a, b) {
    if (a <= 0 || b <= 0) return [0, 0];
    return [Math.floor(L / a), Math.floor(W / b)];
  }

  /** Tiles an L×W rectangle with a×b cells, then fills any leftover strip with a 90°-swapped tiling. */
  gridPlusStrip(L, W, a, b, allowSwap) {
    const [nx, ny] = this.grid(L, W, a, b);
    const rects = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) rects.push({ x: i * a, y: j * b, w: a, h: b });
    }
    const usedX = nx * a;
    const usedY = ny * b;
    const remX = L - usedX;
    const remY = W - usedY;

    let bestExtra = [];
    if (allowSwap && remX >= b && b > 0) {
      const ny2 = Math.floor(W / a);
      const nx2 = Math.floor(remX / b);
      const extra = [];
      for (let i = 0; i < nx2; i++) {
        for (let j = 0; j < ny2; j++) extra.push({ x: usedX + i * b, y: j * a, w: b, h: a });
      }
      if (extra.length > bestExtra.length) bestExtra = extra;
    }
    if (allowSwap && remY >= a && a > 0) {
      const nx3 = Math.floor(L / b);
      const ny3 = Math.floor(remY / a);
      const extra = [];
      for (let i = 0; i < nx3; i++) {
        for (let j = 0; j < ny3; j++) extra.push({ x: i * b, y: usedY + j * a, w: b, h: a });
      }
      if (extra.length > bestExtra.length) bestExtra = extra;
    }
    return rects.concat(bestExtra);
  }

  /** Packs the better of an a×b vs b×a base tiling (when swapping is allowed) into the L×W footprint. */
  packRectangle(L, W, a, b, allowSwap) {
    const candidates = [this.gridPlusStrip(L, W, a, b, allowSwap)];
    if (allowSwap) candidates.push(this.gridPlusStrip(L, W, b, a, allowSwap));
    return candidates.reduce((best, c) => (c.length > best.length ? c : best));
  }

  /** Stacks layers until height or weight capacity is exhausted, then assembles the full StackResult. */
  stackLayers(config) {
    const { box, pallet, additional: add } = config;
    const orientations = this.generateOrientations(box, config.orientationFlags);
    let z = pallet.deckHeight;
    let weightUsed = 0;
    const layers = [];
    let idx = 0;
    let limiting = 'pattern';

    while (idx < MAX_LAYER_ITERATIONS) {
      const useSpacer = add && add.enabled && add.useSpacers && idx > 0;
      const spacerH = useSpacer ? add.spacerThicknessMm : 0;
      const spacerW = useSpacer ? add.spacerWeightKg : 0;
      const remH = config.maxStackHeight - z - spacerH;
      const remW = pallet.loadCapacity - weightUsed - spacerW;
      if (remH <= 0) {
        limiting = 'height';
        break;
      }
      if (remW <= 0) {
        limiting = 'weight';
        break;
      }

      let best = null;
      for (const o of orientations) {
        if (o.dz > remH || o.dz <= 0) continue;
        let rects = this.packRectangle(pallet.length, pallet.width, o.dx, o.dy, config.orientationFlags.allowRotateZ);
        let count = rects.length;
        if (count === 0) continue;
        let layerWeight = count * box.weight;
        if (layerWeight > remW) {
          const maxByWeight = box.weight > 0 ? Math.floor(remW / box.weight) : count;
          if (maxByWeight <= 0) continue;
          rects = rects.slice(0, maxByWeight);
          count = maxByWeight;
          layerWeight = count * box.weight;
        }
        if (best === null || count > best.count) best = { orientation: o, rects, count, weight: layerWeight };
      }

      if (!best || best.count === 0) {
        // Nothing more fits in the remaining height: height-limited (or pattern-limited on the very first layer).
        limiting = idx === 0 ? 'pattern' : 'height';
        break;
      }

      z += spacerH;
      weightUsed += spacerW;
      layers.push(
        new Layer({
          index: idx,
          zStart: z,
          dimX: best.orientation.dx,
          dimY: best.orientation.dy,
          dimZ: best.orientation.dz,
          orientation: best.orientation.label,
          rects: best.rects,
          weight: best.weight,
        })
      );
      z += best.orientation.dz;
      weightUsed += best.weight;
      idx++;
    }

    return this._finalize(config, layers, z, weightUsed, limiting);
  }

  _finalize(config, layers, zCursor, weightUsed, limiting) {
    const { box, pallet, additional: add } = config;
    const footprintArea = pallet.footprintArea;
    const boxVolume = box.volume;

    const placed = [];
    let boxId = 1;
    for (const layer of layers) {
      for (const r of layer.rects) {
        placed.push(
          new PlacedBox({
            boxId: boxId++,
            layer: layer.index,
            x: r.x,
            y: r.y,
            z: layer.zStart,
            dimX: r.w,
            dimY: r.h,
            dimZ: layer.dimZ,
            orientation: layer.orientation,
          })
        );
      }
    }
    const totalBoxes = placed.length;

    // Spacer mass is already folded into weightUsed by stackLayers; only film
    // and corner posts are added here to avoid double-counting.
    let accessoriesWeight = 0;
    if (add && add.enabled) {
      if (add.useFilm) accessoriesWeight += add.filmWeightKg;
      if (add.useCornerPosts) accessoriesWeight += add.cornerPostWeightKg;
    }

    const totalWeight = weightUsed; // boxes + spacers
    const totalHeight = zCursor;
    const usedStackHeight = Math.max(totalHeight - pallet.deckHeight, 1e-9);

    let footprintFill = 0;
    if (layers.length) {
      footprintFill =
        (layers.reduce((s, l) => s + (l.rects.length * (l.dimX * l.dimY)) / footprintArea, 0) / layers.length) * 100;
    }
    const volumeFill =
      footprintArea * usedStackHeight > 0 ? ((totalBoxes * boxVolume) / (footprintArea * usedStackHeight)) * 100 : 0;
    const heightUtil = config.maxStackHeight > 0 ? (totalHeight / config.maxStackHeight) * 100 : 0;
    const weightUtil = pallet.loadCapacity > 0 ? (totalWeight / pallet.loadCapacity) * 100 : 0;

    const recommendations = this.recommendationBuilder.build(config, layers, totalHeight, totalWeight);

    return new StackResult({
      config,
      layers,
      placed,
      totalBoxes,
      totalWeight,
      totalHeight,
      footprintFill,
      volumeFill,
      heightUtil,
      weightUtil,
      recommendations,
      accessoriesWeight,
      grossWeight: totalWeight + accessoriesWeight,
      limiting,
    });
  }
}
