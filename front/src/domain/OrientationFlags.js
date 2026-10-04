export class OrientationFlags {
  constructor({ allowRotateX = false, allowRotateY = false, allowRotateZ = true } = {}) {
    this.allowRotateX = allowRotateX;
    this.allowRotateY = allowRotateY;
    this.allowRotateZ = allowRotateZ;
  }
}
