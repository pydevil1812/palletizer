export class ConfigValidator {
  validate(config) {
    const errors = [];
    const positive = (v, name) => {
      if (!(v > 0)) errors.push(`${name} must be greater than 0`);
    };

    positive(config.box.length, 'Box length');
    positive(config.box.width, 'Box width');
    positive(config.box.height, 'Box height');
    if (!(config.box.weight >= 0)) errors.push('Box weight must be ≥ 0');

    positive(config.pallet.length, 'Pallet length');
    positive(config.pallet.width, 'Pallet width');
    if (!(config.pallet.deckHeight >= 0)) errors.push('Deck height must be ≥ 0');
    positive(config.pallet.loadCapacity, 'Load capacity');

    positive(config.maxStackHeight, 'Max stack height');
    if (config.maxStackHeight <= config.pallet.deckHeight) {
      errors.push('Max stack height must exceed deck height');
    }

    return errors;
  }
}
