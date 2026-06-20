export class Box {
  constructor({ name = 'Box', length, width, height, weight }) {
    this.name = name;
    this.length = length;
    this.width = width;
    this.height = height;
    this.weight = weight;
  }

  get volume() {
    return this.length * this.width * this.height;
  }
}
