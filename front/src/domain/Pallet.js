export class Pallet {
  constructor({ name = 'Pallet', length, width, deckHeight, loadCapacity }) {
    this.name = name;
    this.length = length;
    this.width = width;
    this.deckHeight = deckHeight;
    this.loadCapacity = loadCapacity;
  }

  get footprintArea() {
    return this.length * this.width;
  }
}
