export class PlacedBox {
  constructor({ boxId, layer, x, y, z, dimX, dimY, dimZ, orientation }) {
    this.boxId = boxId;
    this.layer = layer;
    this.x = x;
    this.y = y;
    this.z = z;
    this.dimX = dimX;
    this.dimY = dimY;
    this.dimZ = dimZ;
    this.orientation = orientation;
  }
}
