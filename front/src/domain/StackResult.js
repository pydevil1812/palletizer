export class StackResult {
  constructor({
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
    grossWeight,
    limiting,
  }) {
    this.config = config;
    this.layers = layers;
    this.placed = placed;
    this.totalBoxes = totalBoxes;
    this.totalWeight = totalWeight;
    this.totalHeight = totalHeight;
    this.footprintFill = footprintFill;
    this.volumeFill = volumeFill;
    this.heightUtil = heightUtil;
    this.weightUtil = weightUtil;
    this.recommendations = recommendations;
    this.accessoriesWeight = accessoriesWeight;
    this.grossWeight = grossWeight;
    this.limiting = limiting;
  }

  get limitingLabel() {
    return (
      { height: 'height-limited', weight: 'weight-limited', pattern: 'footprint-limited' }[this.limiting] || '—'
    );
  }

  get boxesPerLayer() {
    return this.layers.map((l) => l.boxCount);
  }
}
