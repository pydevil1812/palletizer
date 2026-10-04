export class Pallet {
  constructor({ name = 'Pallet', length, width, deckHeight, loadCapacity }) {
    this.name = name;
    this.length = length;
    this.width = width;
    this.deckHeight = deckHeight;
    this.loadCapacity = loadCapacity;
  }
}
