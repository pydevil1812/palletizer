import { Box } from './Box.js';
import { Pallet } from './Pallet.js';
import { OrientationFlags } from './OrientationFlags.js';
import { AdditionalElements } from './AdditionalElements.js';

export class PalletConfig {
  constructor({ box, pallet, maxStackHeight, orientationFlags, additional }) {
    this.box = box instanceof Box ? box : new Box(box);
    this.pallet = pallet instanceof Pallet ? pallet : new Pallet(pallet);
    this.maxStackHeight = maxStackHeight;
    this.orientationFlags =
      orientationFlags instanceof OrientationFlags ? orientationFlags : new OrientationFlags(orientationFlags);
    this.additional =
      additional instanceof AdditionalElements ? additional : new AdditionalElements(additional);
  }
}
