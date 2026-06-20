export class Layer {
  constructor({ index, zStart, dimX, dimY, dimZ, orientation, rects, weight }) {
    this.index = index;
    this.zStart = zStart;
    this.dimX = dimX;
    this.dimY = dimY;
    this.dimZ = dimZ;
    this.orientation = orientation;
    this.rects = rects; // [{x, y, w, h}]
    this.weight = weight;
  }

  get boxCount() {
    return this.rects.length;
  }

  get footprintAreaUsed() {
    return this.rects.length * this.dimX * this.dimY;
  }
}
